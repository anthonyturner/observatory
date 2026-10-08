import { type GraphQl, repoVariables } from './github-graphql.ts';
import { nodesOf } from './graphql-fields.ts';
import { field, totalIn } from './graphql-answer.ts';
import { isText } from './rest-json.ts';

/** One discussion thread, as its list shows it. */
export interface DiscussionMark {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly category: string;
  /** Its category takes an answer, as Q&A does. */
  readonly isAnswerable: boolean;
  readonly isAnswered: boolean;
  readonly comments: number;
  readonly author: string | null;
  readonly updatedAt: string;
}

/** A repository's discussions: whether they are on, and the most recently active. */
export interface DiscussionsMark {
  readonly isEnabled: boolean;
  /** Every discussion the repository has, past the ones listed. */
  readonly total: number;
  /** Most recently active first. */
  readonly threads: readonly DiscussionMark[];
}

/** What the Milestones screen reads of a repository's discussions, and nothing else. */
export interface DiscussionReader {
  discussions(repo: string): Promise<DiscussionsMark>;
}

/** Enough to show what is being talked about now; GitHub holds the rest. */
export const DISCUSSION_LIMIT = 30;

export const DISCUSSIONS_QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    hasDiscussionsEnabled
    discussions(first: ${DISCUSSION_LIMIT}, orderBy: { field: UPDATED_AT, direction: DESC }) {
      totalCount
      nodes {
        number title url updatedAt answerChosenAt
        category { name isAnswerable }
        comments { totalCount }
        author { login }
      }
    }
  }
}`;

function threadOf(node: unknown): DiscussionMark | null {
  const number = field(node, 'number');
  const title = field(node, 'title');
  const url = field(node, 'url');
  const updatedAt = field(node, 'updatedAt');
  const category = field(node, 'category');
  const categoryName = field(category, 'name');
  if (!Number.isInteger(number) || !isText(title) || !isText(url) || !isText(updatedAt)) {
    return null;
  }
  const login = field(field(node, 'author'), 'login');
  return {
    number: Number(number),
    title,
    url,
    category: isText(categoryName) ? categoryName : 'General',
    isAnswerable: field(category, 'isAnswerable') === true,
    isAnswered: isText(field(node, 'answerChosenAt')),
    comments: totalIn(field(node, 'comments')),
    author: isText(login) ? login : null,
    updatedAt,
  };
}

/** The discussions in a `DISCUSSIONS_QUERY` answer. */
export function discussionsOf(data: unknown): DiscussionsMark {
  const repository = field(data, 'repository');
  const connection = field(repository, 'discussions');
  return {
    isEnabled: field(repository, 'hasDiscussionsEnabled') === true,
    total: totalIn(connection),
    threads: nodesOf(connection)
      .map(threadOf)
      .filter((thread) => thread !== null),
  };
}

/** The reader over one way of asking GitHub's GraphQL API. */
export const discussionReader = (graphql: GraphQl): DiscussionReader => ({
  discussions: async (repo) => discussionsOf(await graphql(DISCUSSIONS_QUERY, repoVariables(repo))),
});
