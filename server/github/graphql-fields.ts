/**
 * `gh --json` field names as GraphQL selections, and how to reshape each answer
 * the way `gh` does, so a report reads the same whichever reader built it.
 * `gh` is itself built on GitHub's GraphQL API with these names; where it
 * reshapes (connections flattened to arrays, a null string read as `""`, a
 * check's workflow lifted to `workflowName`), the table does the same.
 */

/** One field: what to ask GraphQL for, and how to shape its answer like `gh`. */
interface Field {
  readonly select: string;
  readonly shape: (value: unknown) => unknown;
}

type Node = Readonly<Record<string, unknown>>;

const asNode = (value: unknown): Node =>
  typeof value === 'object' && value !== null ? (value as Node) : {};

/** A connection's nodes as an array, as `gh` flattens them. */
export const nodesOf = (connection: unknown): Node[] => {
  const nodes = asNode(connection)['nodes'];
  return Array.isArray(nodes) ? nodes.map(asNode) : [];
};

const asIs = (value: unknown): unknown => value;
/** `gh` reads a null string as empty. */
const orEmpty = (value: unknown): unknown => value ?? '';

const connection = (name: string, first: number, fields: string): Field => ({
  select: `${name}(first: ${first}) { nodes { ${fields} } }`,
  shape: nodesOf,
});

/** GraphQL's checks as `gh` lists them: a check run or a commit status. */
function checkOf(check: Node): Node {
  if (check['__typename'] === 'StatusContext') {
    return {
      __typename: 'StatusContext',
      context: check['context'],
      startedAt: check['createdAt'],
      state: check['state'],
      targetUrl: orEmpty(check['targetUrl']),
    };
  }
  const workflow = asNode(asNode(asNode(check['checkSuite'])['workflowRun'])['workflow']);
  return {
    __typename: 'CheckRun',
    completedAt: check['completedAt'],
    conclusion: orEmpty(check['conclusion']),
    detailsUrl: orEmpty(check['detailsUrl']),
    name: check['name'],
    startedAt: check['startedAt'],
    status: check['status'],
    workflowName: orEmpty(workflow['name']),
  };
}

const CHECKS = `__typename
  ... on CheckRun { name status conclusion startedAt completedAt detailsUrl
    checkSuite { workflowRun { workflow { name } } } }
  ... on StatusContext { context state targetUrl createdAt }`;

/** An account as `gh` gives it: a user with its id and name, anything else an app. */
function actorOf(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const actor = asNode(value);
  if (actor['__typename'] !== 'User')
    return { is_bot: true, login: `app/${String(actor['login'])}` };
  return { id: actor['id'], is_bot: false, login: actor['login'], name: orEmpty(actor['name']) };
}

const ACTOR = '{ __typename login ... on User { id name } }';

function reviewerOf(request: Node): Node {
  const reviewer = asNode(request['requestedReviewer']);
  return reviewer['__typename'] === 'Team'
    ? { __typename: 'Team', name: reviewer['name'], slug: reviewer['slug'] }
    : { __typename: reviewer['__typename'], login: reviewer['login'] };
}

const LABELS = connection('labels', 100, 'id name description color');
const labelsOf = (value: unknown): Node[] =>
  nodesOf(value).map((label) => ({ ...label, description: orEmpty(label['description']) }));

const ASSIGNEES: Field = {
  select: 'assignees(first: 100) { nodes { id login name databaseId } }',
  shape: (value) => nodesOf(value).map((person) => ({ ...person, name: orEmpty(person['name']) })),
};

/** A commit's authors as `gh` gives them, with an empty login for one GitHub does not know. */
function commitOf(node: Node): Node {
  const commit = asNode(node['commit']);
  return {
    authoredDate: commit['authoredDate'],
    authors: nodesOf(commit['authors']).map((author) => {
      const user = asNode(author['user']);
      return {
        email: orEmpty(author['email']),
        id: orEmpty(user['id']),
        login: orEmpty(user['login']),
        name: orEmpty(author['name']),
      };
    }),
    committedDate: commit['committedDate'],
    messageBody: commit['messageBody'],
    messageHeadline: commit['messageHeadline'],
    oid: commit['oid'],
  };
}

const scalars = (names: readonly string[]): Record<string, Field> =>
  Object.fromEntries(names.map((name) => [name, { select: name, shape: asIs }]));

export const PULL_GRAPHQL: Readonly<Record<string, Field>> = {
  ...scalars([
    'number',
    'title',
    'body',
    'url',
    'state',
    'isDraft',
    'mergeable',
    'headRefName',
    'baseRefName',
    'headRefOid',
    'additions',
    'deletions',
    'changedFiles',
    'createdAt',
    'updatedAt',
  ]),
  reviewDecision: { select: 'reviewDecision', shape: orEmpty },
  author: { select: `author ${ACTOR}`, shape: actorOf },
  labels: { ...LABELS, shape: labelsOf },
  closingIssuesReferences: connection(
    'closingIssuesReferences',
    100,
    'id number url repository { id name owner { id login } }',
  ),
  statusCheckRollup: {
    select: `commits(last: 1) { nodes { commit { statusCheckRollup {
      contexts(first: 100) { nodes { ${CHECKS} } } } } } }`,
    shape: (value) =>
      nodesOf(asNode(asNode(nodesOf(value)[0]?.['commit'])['statusCheckRollup'])['contexts']).map(
        checkOf,
      ),
  },
  reviewRequests: {
    select: `reviewRequests(first: 100) { nodes { requestedReviewer { __typename
      ... on User { login } ... on Bot { login } ... on Mannequin { login } ... on Team { name slug } } } }`,
    shape: (value) => nodesOf(value).map(reviewerOf),
  },
  latestReviews: {
    select: `latestReviews(first: 100) { nodes { id author { login } authorAssociation body
      submittedAt includesCreatedEdit state commit { oid } } }`,
    shape: nodesOf,
  },
  files: connection('files', 100, 'path additions deletions changeType'),
  assignees: ASSIGNEES,
  // The latest hundred, oldest first, as `gh` lists a pull request of up to that many.
  commits: {
    select: `commits(last: 100) { nodes { commit { oid messageHeadline messageBody committedDate
      authoredDate authors(first: 100) { nodes { email name user { id login } } } } } }`,
    shape: (value) => nodesOf(value).map(commitOf),
  },
};

export const ISSUE_GRAPHQL: Readonly<Record<string, Field>> = {
  ...scalars(['number', 'title', 'url', 'createdAt', 'updatedAt']),
  labels: { ...LABELS, shape: labelsOf },
  assignees: ASSIGNEES,
};

/** The GraphQL selection for `fields`, and a function that shapes one node like `gh`. */
export function selectionOf(
  table: Readonly<Record<string, Field>>,
  fields: readonly string[],
): { readonly select: string; readonly shape: (node: unknown) => Node } {
  const known = fields.map((name) => {
    const field = table[name];
    if (!field) throw new Error(`no GraphQL mapping for the gh field ${name}`);
    return [name, field] as const;
  });
  return {
    // Each field is aliased to its gh name, so two can read one connection.
    select: known.map(([name, field]) => `${name}: ${field.select}`).join('\n'),
    shape: (node) =>
      Object.fromEntries(known.map(([name, field]) => [name, field.shape(asNode(node)[name])])),
  };
}
