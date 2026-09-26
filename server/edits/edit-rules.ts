import { MERGE_METHODS, type PullChanges } from '../github/pull-writer.ts';
import type { EditChanges } from './edit-request.ts';

/** A GitHub login, or `@me` for the signed-in account. */
const LOGIN = /^(@me|[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))$/;
const FULL_OID = /^[0-9a-f]{40}$/;
const TITLE_MAX = 256;
const BODY_MAX = 65536;
const LINE_BREAK = /[\r\n]/;

const PEOPLE_KEYS = ['addAssignees', 'removeAssignees', 'addReviewers', 'removeReviewers'] as const;
const LABEL_KEYS = ['addLabels', 'removeLabels'] as const;
const SAFE_KEYS: readonly (keyof PullChanges)[] = ['title', 'body', ...LABEL_KEYS, ...PEOPLE_KEYS];

function titleProblems(title: string | undefined): string[] {
  if (title === undefined) return [];
  if (!title.trim()) return ['title is empty'];
  if (title.length > TITLE_MAX) return [`title is over ${TITLE_MAX} characters`];
  if (LINE_BREAK.test(title)) return ['title contains a line break'];
  return [];
}

function mergeProblems(merge: EditChanges['merge']): string[] {
  if (!merge) return [];
  const problems: string[] = [];
  if (!MERGE_METHODS.includes(merge.method)) {
    problems.push('merge method must be squash, merge or rebase');
  }
  if (!FULL_OID.test(merge.headOid)) {
    problems.push('merge is not pinned to the commit that was reviewed');
  }
  return problems;
}

/** Everything wrong with an edit that the page could not legitimately have sent. */
export function editProblems(changes: EditChanges, knownLabels: ReadonlySet<string>): string[] {
  const problems = titleProblems(changes.title);
  if (changes.body !== undefined && changes.body.length > BODY_MAX) {
    problems.push(`body is over ${BODY_MAX} characters`);
  }
  for (const key of LABEL_KEYS) {
    // Only labels that already exist: a typo must not quietly create one.
    for (const label of changes[key] ?? []) {
      if (!knownLabels.has(label))
        problems.push(`label "${label}" does not exist in this repository`);
    }
  }
  for (const key of PEOPLE_KEYS) {
    for (const who of changes[key] ?? []) {
      if (!LOGIN.test(who)) problems.push(`"${who}" is not a GitHub login`);
    }
  }
  return [...problems, ...mergeProblems(changes.merge)];
}

/** The reversible changes alone, with the title trimmed, as `gh pr edit` takes them. */
export function safeChangesOf(changes: EditChanges): PullChanges {
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_KEYS) {
    const value = changes[key];
    if (value === undefined || (Array.isArray(value) && !value.length)) continue;
    safe[key] = key === 'title' ? (value as string).trim() : value;
  }
  return safe as PullChanges;
}
