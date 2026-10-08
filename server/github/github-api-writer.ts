import { type CheckRerunner, rerunFailedJobsPath } from './check-rerunner.ts';
import type { GraphQl } from './github-graphql.ts';
import type { Rest } from './github-rest.ts';
import { type InboxMarker, NOTIFICATIONS_PATH, threadPath } from './inbox-marker.ts';
import type { LivePull, PullChanges, PullWriter } from './pull-writer.ts';

type Node = Readonly<Record<string, unknown>>;

const asNode = (value: unknown): Node =>
  typeof value === 'object' && value !== null ? (value as Node) : {};

/** The signed-in account, as `@me` stands for it in `gh`. */
const ME = '@me';

const pullQuery = (
  select: string,
): string => `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) { pullRequest(number: $number) { ${select} } }
}`;

/** Changes pull requests through GitHub's API with the server's token: what
 *  the hosted site uses where this machine uses `gh`. */
export function githubApiWriter(graphql: GraphQl, rest: Rest): PullWriter {
  const pullOf = async (repo: string, number: number, select: string): Promise<Node> => {
    const [owner, name] = repo.split('/');
    const data = await graphql(pullQuery(select), { owner, name, number });
    const pull = asNode(asNode(data)['repository'])['pullRequest'];
    if (!pull) throw new Error(`GitHub: ${repo} has no pull request ${number}`);
    return asNode(pull);
  };
  let viewer: Promise<string> | null = null;
  const loginOf = (who: string): Promise<string> => {
    if (who !== ME) return Promise.resolve(who);
    viewer ??= graphql('query { viewer { login } }').then((data) =>
      String(asNode(asNode(data)['viewer'])['login']),
    );
    return viewer;
  };
  const logins = (list: readonly string[]): Promise<string[]> => Promise.all(list.map(loginOf));

  async function editPull(repo: string, number: number, changes: PullChanges): Promise<void> {
    const base = `/repos/${repo}`;
    const fields = {
      ...(changes.title === undefined ? {} : { title: changes.title }),
      ...(changes.body === undefined ? {} : { body: changes.body }),
    };
    if (Object.keys(fields).length) {
      await rest({ method: 'PATCH', path: `${base}/pulls/${number}`, body: fields });
    }
    if (changes.addLabels?.length) {
      await rest({
        method: 'POST',
        path: `${base}/issues/${number}/labels`,
        body: { labels: changes.addLabels },
      });
    }
    for (const label of changes.removeLabels ?? []) {
      await rest({
        method: 'DELETE',
        path: `${base}/issues/${number}/labels/${encodeURIComponent(label)}`,
      });
    }
    await editPeople(`${base}/issues/${number}/assignees`, 'assignees', {
      add: changes.addAssignees,
      remove: changes.removeAssignees,
    });
    await editPeople(`${base}/pulls/${number}/requested_reviewers`, 'reviewers', {
      add: changes.addReviewers,
      remove: changes.removeReviewers,
    });
  }

  async function editPeople(
    path: string,
    field: string,
    { add, remove }: { add?: readonly string[]; remove?: readonly string[] },
  ): Promise<void> {
    if (add?.length) await rest({ method: 'POST', path, body: { [field]: await logins(add) } });
    if (remove?.length) {
      await rest({ method: 'DELETE', path, body: { [field]: await logins(remove) } });
    }
  }

  return {
    livePull: async (repo, number) =>
      (await pullOf(repo, number, 'state isDraft headRefOid mergeable')) as unknown as LivePull,
    editPull,
    async markReady(repo, number) {
      const { id } = await pullOf(repo, number, 'id');
      await graphql(
        'mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { clientMutationId } }',
        { id },
      );
    },
    // `sha` makes GitHub refuse the merge if the branch has moved, as `--match-head-commit` does.
    async mergePull(repo, number, { method, headOid }) {
      await rest({
        method: 'PUT',
        path: `/repos/${repo}/pulls/${number}/merge`,
        body: { merge_method: method, sha: headOid },
      });
    },
  };
}

/** Reruns failed GitHub Actions jobs through GitHub's REST API with the server's token. */
export function githubApiRerunner(rest: Rest): CheckRerunner {
  return {
    rerunFailedJobs: async (repo, runId) => {
      await rest({ method: 'POST', path: `/${rerunFailedJobsPath(repo, runId)}` });
    },
  };
}

/** Marks notifications read through GitHub's REST API with the server's token. */
export function githubApiInboxMarker(rest: Rest): InboxMarker {
  return {
    markThreadRead: async (threadId) => {
      await rest({ method: 'PATCH', path: `/${threadPath(threadId)}` });
    },
    markAllRead: async (lastReadAt) => {
      await rest({
        method: 'PUT',
        path: `/${NOTIFICATIONS_PATH}`,
        body: { last_read_at: lastReadAt, read: true },
      });
    },
  };
}
