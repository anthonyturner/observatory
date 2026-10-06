import { BadRequest } from '../http/api-handler.ts';
import { commitShaFrom } from '../queue/commit-diff.ts';
import { pullNumberFrom } from '../queue/pull-detail.ts';
import { repoNameFrom } from '../queue/repo-name.ts';

/** One repository's triage. Keys are pull request numbers. */
export interface TriageState {
  /** When each was marked seen. */
  readonly seen: Readonly<Record<string, string>>;
  /** The pull request's `updatedAt` when it was dismissed: a later change brings it back. */
  readonly dismissed: Readonly<Record<string, string>>;
  /** When each snooze ends. */
  readonly snoozed: Readonly<Record<string, string>>;
  /** The head commit each was last looked at: marked seen, or opened on the PR screen. */
  readonly looked: Readonly<Record<string, string>>;
  /** When each one's triage last changed, restores included: triage is kept here and on the
   *  hosted site, and a push merges the two by whichever changed a pull request last. */
  readonly changed: Readonly<Record<string, string>>;
}

export const EMPTY_TRIAGE: TriageState = {
  seen: {},
  dismissed: {},
  snoozed: {},
  looked: {},
  changed: {},
};

export const TRIAGE_ACTIONS = ['seen', 'unseen', 'dismiss', 'snooze', 'restore', 'look'] as const;
export type TriageAction = (typeof TRIAGE_ACTIONS)[number];

/** Why a pull request is out of the queue for now. */
export type Hidden =
  { readonly reason: 'dismissed' } | { readonly reason: 'snoozed'; readonly until: string };

/** A pull request's triage as the queue shows it. */
export interface PullTriage {
  readonly isSeen: boolean;
  readonly hidden: Hidden | null;
  /** The head commit when it was last looked at, or null when it never was. */
  readonly lookedSha: string | null;
}

const DAY_MS = 86_400_000;
const MAX_SNOOZE_DAYS = 90;

const without = (record: Readonly<Record<string, string>>, key: string): Record<string, string> => {
  const copy = { ...record };
  delete copy[key];
  return copy;
};

interface ActionContext {
  readonly now: number;
  readonly updatedAt: string;
  readonly days?: number;
  /** The head commit a look or a seen mark records; empty records none. */
  readonly headSha?: string;
}

/** `state` with `headSha` as the head pull request `key` was last looked at. */
function lookedAt(state: TriageState, key: string, headSha: string | undefined): TriageState {
  return headSha ? { ...state, looked: { ...state.looked, [key]: headSha } } : state;
}

/** The state after `action` on pull request `number`, marked as changed now unless it is a look. */
export function applyTriage(
  state: TriageState,
  number: number,
  action: TriageAction,
  context: ActionContext,
): TriageState {
  const key = String(number);
  // A look is bookkeeping, not a choice: stamping it as one would let opening a
  // pull request here outvote a dismissal or snooze made on the hosted site.
  const next = applied(state, key, action, context);
  if (action === 'look') return next;
  return { ...next, changed: { ...state.changed, [key]: new Date(context.now).toISOString() } };
}

function applied(
  state: TriageState,
  key: string,
  action: TriageAction,
  context: ActionContext,
): TriageState {
  const now = new Date(context.now).toISOString();
  switch (action) {
    case 'seen':
      return lookedAt({ ...state, seen: { ...state.seen, [key]: now } }, key, context.headSha);
    case 'look':
      return lookedAt(state, key, context.headSha);
    case 'unseen':
      return { ...state, seen: without(state.seen, key) };
    case 'dismiss':
      return { ...state, dismissed: { ...state.dismissed, [key]: context.updatedAt } };
    case 'snooze': {
      const until = new Date(context.now + (context.days ?? 1) * DAY_MS).toISOString();
      return { ...state, snoozed: { ...state.snoozed, [key]: until } };
    }
    case 'restore':
      return {
        ...state,
        dismissed: without(state.dismissed, key),
        snoozed: without(state.snoozed, key),
      };
  }
}

/** Where pull request `number`, last changed at `updatedAt`, stands now. */
export function triageOf(
  state: TriageState,
  number: number,
  updatedAt: string,
  now: number,
): PullTriage {
  const key = String(number);
  const dismissedAt = state.dismissed[key];
  const snoozedUntil = state.snoozed[key];
  let hidden: Hidden | null = null;
  if (dismissedAt && Date.parse(updatedAt) <= Date.parse(dismissedAt)) {
    hidden = { reason: 'dismissed' };
  } else if (snoozedUntil && now < Date.parse(snoozedUntil)) {
    hidden = { reason: 'snoozed', until: snoozedUntil };
  }
  return { isSeen: key in state.seen, hidden, lookedSha: state.looked[key] ?? null };
}

export interface TriageRequest {
  readonly repo: string;
  readonly number: number;
  readonly action: TriageAction;
  readonly days?: number;
  /** The head the screen showed, for a look or a seen mark; else the queue's. */
  readonly sha?: string;
}

/** A triage request from a POST body, or a BadRequest saying what is wrong. */
export function triageRequestFrom(body: unknown): TriageRequest {
  if (typeof body !== 'object' || body === null) throw new BadRequest('body must be an object');
  const { repo, number, action, days, sha } = body as Record<string, unknown>;
  if (!(TRIAGE_ACTIONS as readonly unknown[]).includes(action)) {
    throw new BadRequest(`action must be one of ${TRIAGE_ACTIONS.join(', ')}`);
  }
  const request = {
    repo: repoNameFrom(typeof repo === 'string' ? repo : null),
    number: pullNumberFrom(typeof number === 'number' ? String(number) : null),
    action: action as TriageAction,
    ...(sha === undefined ? {} : { sha: commitShaFrom(typeof sha === 'string' ? sha : null) }),
  };
  if (action !== 'snooze') return request;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_SNOOZE_DAYS) {
    throw new BadRequest(`days must be a whole number from 1 to ${MAX_SNOOZE_DAYS}`);
  }
  return { ...request, days };
}
