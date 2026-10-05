import { NUMBER_QUERY } from '../issues/issue-list';

/** An open pull request as the search reads it. */
export interface SearchedPull {
  readonly number: number;
  readonly title: string;
  readonly closes: readonly number[];
}

/** An issue as the search reads it. */
export interface SearchedIssue {
  readonly number: number;
  readonly title: string;
  readonly comet: boolean;
}

/** Where a search lands: a star, a comet, or an issue with nothing on the sky. */
export type SkyFind =
  | { readonly kind: 'pull'; readonly number: number }
  | { readonly kind: 'comet'; readonly issue: number }
  | { readonly kind: 'issue'; readonly issue: number };

/** A picked suggestion, "#12 Title", searches by its number. */
const SUGGESTION = /^#(\d+)\s/;

/**
 * The pull request or issue a query names: by number when it is one (or a
 * picked suggestion), else by title. Pull requests win over issues; an issue an open pull request
 * closes lands on that pull request's star.
 */
export function findOnSky(
  query: string,
  pulls: readonly SearchedPull[],
  issues: readonly SearchedIssue[],
): SkyFind | null {
  const text = query.trim().toLowerCase();
  if (!text) return null;
  const number = (NUMBER_QUERY.exec(text) ?? SUGGESTION.exec(text))?.[1];
  const matches = (each: { number: number; title: string }): boolean =>
    number ? each.number === Number(number) : each.title.toLowerCase().includes(text);
  const pull = pulls.find(matches);
  if (pull) return { kind: 'pull', number: pull.number };
  const issue = issues.find(matches);
  if (!issue) return null;
  const closer = pulls.find((each) => each.closes.includes(issue.number));
  if (closer) return { kind: 'pull', number: closer.number };
  return issue.comet
    ? { kind: 'comet', issue: issue.number }
    : { kind: 'issue', issue: issue.number };
}

/** The suggestions under the box: "#12 Title", pull requests first. */
export function searchSuggestions(
  pulls: readonly SearchedPull[],
  issues: readonly SearchedIssue[],
): string[] {
  return [...pulls, ...issues].map((each) => `#${each.number} ${each.title}`);
}
