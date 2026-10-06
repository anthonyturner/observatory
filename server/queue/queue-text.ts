import { TRIAGE_ACTIONS, type TriageAction } from '../triage/triage.ts';
import type { TriagedItem, TriagedQueue } from '../triage/triaged-queue.ts';

/** What the terminal queue was asked: show the queue, or act on one pull request. */
export type QueueCommand =
  | { readonly kind: 'show'; readonly all: boolean }
  | {
      readonly kind: 'act';
      readonly action: TriageAction;
      readonly number: number;
      readonly days?: number;
    };

export interface QueueArgs {
  /** `owner/name`, or null to take it from the checkout's origin. */
  readonly repo: string | null;
  readonly command: QueueCommand;
  readonly json: boolean;
}

export const QUEUE_USAGE = `Usage: npm run queue -- [owner/repo] [all | seen <pr> | unseen <pr> | dismiss <pr> | snooze <pr> <days> | restore <pr> | look <pr>] [--json]`;

const REPO = /^[\w.-]+\/[\w.-]+$/;

/** The command line, read; throws with the usage when it does not make sense. */
export function parseQueueArgs(argv: readonly string[]): QueueArgs {
  const json = argv.includes('--json');
  const words = argv.filter((word) => word !== '--json');
  const repo = words[0] && REPO.test(words[0]) ? words[0] : null;
  const rest = repo ? words.slice(1) : words;
  const fail = (why: string): never => {
    throw new Error(`${why}\n${QUEUE_USAGE}`);
  };
  if (!rest.length) return { repo, json, command: { kind: 'show', all: false } };
  const [verb, pr, days] = rest;
  if (verb === 'all' && rest.length === 1)
    return { repo, json, command: { kind: 'show', all: true } };
  if (!(TRIAGE_ACTIONS as readonly string[]).includes(verb)) fail(`Unknown command: ${verb}`);
  const number = Number(pr?.replace(/^#/, ''));
  if (!Number.isInteger(number) || number < 1) fail('Name the pull request by its number.');
  const action = verb as TriageAction;
  if (action !== 'snooze') return { repo, json, command: { kind: 'act', action, number } };
  const wait = Number(days ?? 1);
  if (!Number.isInteger(wait) || wait < 1 || wait > 90) fail('Snooze for 1 to 90 days.');
  return { repo, json, command: { kind: 'act', action, number, days: wait } };
}

/** The GitHub `owner/name` of a remote's address, https or ssh; null for anything else. */
export function repoFromRemote(url: string): string | null {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

/** A bucket as the queue says it, most urgent first; `fresh` is waiting but already seen. */
const LABELS: Readonly<Record<string, string>> = {
  conflicted: 'Cannot merge',
  failing: 'Checks failing',
  unknown: 'Mergeability unknown',
  unlinked: 'No issue linked',
  unreviewed: 'Waiting on you',
  fresh: 'Seen already',
};

/** Where an item sits: its bucket, but a seen item waiting on you is only context. */
export const shownBucket = (item: TriagedItem): string =>
  item.bucket === 'unreviewed' && item.isSeen ? 'fresh' : item.bucket;

const hiddenNote = (item: TriagedItem): string => {
  if (!item.hidden) return '';
  return item.hidden.reason === 'dismissed'
    ? ' [dismissed]'
    : ` [snoozed to ${item.hidden.until.slice(0, 10)}]`;
};

/** The queue as plain text: the counts, then one line per pull request, blocked first.
 *  Dismissed and snoozed ones only with `all`, marked. */
export function renderQueue(queue: TriagedQueue, all: boolean): string {
  const items = queue.items.filter((item) => all || !item.hidden);
  const hiddenCount = queue.items.length - queue.items.filter((item) => !item.hidden).length;
  const lines = [
    `${queue.repo} · ${items.length} in the queue${hiddenCount && !all ? ` · ${hiddenCount} hidden (all shows them)` : ''}`,
  ];
  if (!items.length) return [...lines, 'Nothing is waiting on you.'].join('\n');
  const order = Object.keys(LABELS);
  const counts = order
    .map((bucket) => [bucket, items.filter((item) => shownBucket(item) === bucket).length] as const)
    .filter(([, count]) => count > 0)
    .map(([bucket, count]) => `${LABELS[bucket]} ${count}`);
  lines.push(counts.join(' · '), '');
  const sorted = [...items].sort(
    (a, b) => order.indexOf(shownBucket(a)) - order.indexOf(shownBucket(b)),
  );
  for (const item of sorted) {
    const closes = item.closes.length
      ? `closes ${item.closes.map((n) => `#${n}`).join(', ')}`
      : 'closes no issue';
    const draft = item.isDraft ? ' (draft)' : '';
    lines.push(
      `#${item.number}  ${LABELS[shownBucket(item)]} · ${item.idleDays}d idle · ${closes}${hiddenNote(item)}`,
      `      ${item.title}${draft}`,
      `      ${item.url}`,
    );
  }
  return lines.join('\n');
}

/** One line saying where a pull request now stands after `action`. */
export function actedLine(
  action: TriageAction,
  number: number,
  result: { isSeen: boolean; hidden: TriagedItem['hidden'] },
): string {
  if (result.hidden?.reason === 'snoozed')
    return `#${number} snoozed until ${result.hidden.until.slice(0, 10)}.`;
  if (result.hidden?.reason === 'dismissed')
    return `#${number} dismissed; a new push brings it back.`;
  if (action === 'restore') return `#${number} is back in the queue.`;
  if (action === 'look') return `#${number} looked at: commits pushed after now show as new.`;
  return result.isSeen ? `#${number} marked seen.` : `#${number} marked unseen.`;
}
