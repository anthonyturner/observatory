import { DoneItem, DoneKind } from '../../core/queue/done-work';
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

/** Where a search lands: a star, a comet, an issue with nothing on the sky, or finished work. */
export type SkyFind =
  | { readonly kind: 'pull'; readonly number: number }
  | { readonly kind: 'comet'; readonly issue: number }
  | { readonly kind: 'issue'; readonly issue: number }
  | { readonly kind: 'done'; readonly item: DoneItem };

/** How a suggestion for finished work says it finished. */
const FINISHED: Readonly<Record<DoneKind, string>> = {
  merged: 'merged',
  closed: 'closed',
  issue: 'done',
  dropped: 'dropped',
};

/** A picked suggestion, "#12 Title", searches by its number. */
const SUGGESTION = /^#(\d+)\s/;

/**
 * The pull request or issue a query names: by number when it is one (or a
 * picked suggestion), else by title. Open pull requests win over open issues,
 * and both over finished work; an issue an open pull request closes lands on
 * that pull request's star.
 */
export function findOnSky(
  query: string,
  pulls: readonly SearchedPull[],
  issues: readonly SearchedIssue[],
  done: readonly DoneItem[] = [],
): SkyFind | null {
  const text = query.trim().toLowerCase();
  if (!text) return null;
  const number = (NUMBER_QUERY.exec(text) ?? SUGGESTION.exec(text))?.[1];
  const matches = (each: { number: number; title: string }): boolean =>
    number ? each.number === Number(number) : each.title.toLowerCase().includes(text);
  const pull = pulls.find(matches);
  if (pull) return { kind: 'pull', number: pull.number };
  const issue = issues.find(matches);
  if (!issue) {
    const item = done.find(matches);
    return item ? { kind: 'done', item } : null;
  }
  const closer = pulls.find((each) => each.closes.includes(issue.number));
  if (closer) return { kind: 'pull', number: closer.number };
  return issue.comet
    ? { kind: 'comet', issue: issue.number }
    : { kind: 'issue', issue: issue.number };
}

/** The suggestions under the box: "#12 Title", open work first, then "#9 Title · merged". */
export function searchSuggestions(
  pulls: readonly SearchedPull[],
  issues: readonly SearchedIssue[],
  done: readonly DoneItem[] = [],
): string[] {
  return [
    ...[...pulls, ...issues].map((each) => `#${each.number} ${each.title}`),
    ...done.map((item) => `#${item.number} ${item.title} · ${FINISHED[item.kind]}`),
  ];
}

/** A suggestion's title and, for finished work, how it finished, for a row to show apart. */
export function suggestionParts(suggestion: string): { text: string; tag: string | null } {
  const at = suggestion.lastIndexOf(' · ');
  const tag = at < 0 ? '' : suggestion.slice(at + 3);
  return Object.values(FINISHED).includes(tag)
    ? { text: suggestion.slice(0, at), tag }
    : { text: suggestion, tag: null };
}

/** The suggestions a typed query leaves, at most `cap`: all of them for a blank box. */
export function suggestionsFor(all: readonly string[], query: string, cap: number): string[] {
  const text = query.trim().toLowerCase();
  return all.filter((each) => each.toLowerCase().includes(text)).slice(0, cap);
}
