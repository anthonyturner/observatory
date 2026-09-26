import { BadRequest } from '../http/api-handler.ts';
import { pullNumberFrom } from '../queue/pull-detail.ts';
import { repoNameFrom } from '../queue/repo-name.ts';

/** One repository's triage, kept on this machine. Keys are pull request numbers. */
export interface TriageState {
  /** When each was marked seen. */
  readonly seen: Readonly<Record<string, string>>;
  /** The pull request's `updatedAt` when it was dismissed: a later change brings it back. */
  readonly dismissed: Readonly<Record<string, string>>;
  /** When each snooze ends. */
  readonly snoozed: Readonly<Record<string, string>>;
}

export const EMPTY_TRIAGE: TriageState = { seen: {}, dismissed: {}, snoozed: {} };

export const TRIAGE_ACTIONS = ['seen', 'unseen', 'dismiss', 'snooze', 'restore'] as const;
export type TriageAction = (typeof TRIAGE_ACTIONS)[number];

/** Why a pull request is out of the queue for now. */
export type Hidden =
  { readonly reason: 'dismissed' } | { readonly reason: 'snoozed'; readonly until: string };

/** A pull request's triage as the queue shows it. */
export interface PullTriage {
  readonly isSeen: boolean;
  readonly hidden: Hidden | null;
}

const DAY_MS = 86_400_000;
const MAX_SNOOZE_DAYS = 90;

const without = (record: Readonly<Record<string, string>>, key: string): Record<string, string> => {
  const copy = { ...record };
  delete copy[key];
  return copy;
};

/** The state after `action` on pull request `number`. */
export function applyTriage(
  state: TriageState,
  number: number,
  action: TriageAction,
  context: { readonly now: number; readonly updatedAt: string; readonly days?: number },
): TriageState {
  const key = String(number);
  const now = new Date(context.now).toISOString();
  switch (action) {
    case 'seen':
      return { ...state, seen: { ...state.seen, [key]: now } };
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
  return { isSeen: key in state.seen, hidden };
}

export interface TriageRequest {
  readonly repo: string;
  readonly number: number;
  readonly action: TriageAction;
  readonly days?: number;
}

/** A triage request from a POST body, or a BadRequest saying what is wrong. */
export function triageRequestFrom(body: unknown): TriageRequest {
  if (typeof body !== 'object' || body === null) throw new BadRequest('body must be an object');
  const { repo, number, action, days } = body as Record<string, unknown>;
  if (!(TRIAGE_ACTIONS as readonly unknown[]).includes(action)) {
    throw new BadRequest(`action must be one of ${TRIAGE_ACTIONS.join(', ')}`);
  }
  const request = {
    repo: repoNameFrom(typeof repo === 'string' ? repo : null),
    number: pullNumberFrom(typeof number === 'number' ? String(number) : null),
    action: action as TriageAction,
  };
  if (action !== 'snooze') return request;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > MAX_SNOOZE_DAYS) {
    throw new BadRequest(`days must be a whole number from 1 to ${MAX_SNOOZE_DAYS}`);
  }
  return { ...request, days };
}
