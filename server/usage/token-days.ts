import type { AssistantMessage, TokenDay } from './usage-types.ts';

const DAY_MS = 24 * 3_600_000;
const NOON_MS = 12 * 3_600_000;

/** Series are grouped by family, so a new model version keeps its family. */
const FAMILIES = ['opus', 'sonnet', 'haiku', 'fable'] as const;

export const familyOf = (model: string): string =>
  FAMILIES.find((family) => model.includes(family)) ?? 'other';

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** "2026-09-26": the local calendar day. */
export function localDayKey(epochMs: number): string {
  const date = new Date(epochMs);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

/** Local midnight at the start of the first of `days` days ending today. */
export function windowStart(now: number, days: number): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
}

/** Tokens that took work: input, output and cache writes. Cache reads are
 *  counted apart by Claude Code and would swamp the rest. */
const workTokens = (message: AssistantMessage): number =>
  message.input + message.output + message.cacheWrite;

/** One row per local day, oldest first, with each family's tokens that day.
 *  A day with no messages is still a row, so the series has no holes. */
export function tokenDays(
  messages: readonly AssistantMessage[],
  now: number,
  days: number,
): TokenDay[] {
  const from = windowStart(now, days);
  // Noon, not midnight: a day-length step from noon stays inside the right
  // day across a daylight-saving change.
  const keys = Array.from({ length: days }, (_, index) =>
    localDayKey(from + index * DAY_MS + NOON_MS),
  );
  const totals = new Map(keys.map((key) => [key, {} as Record<string, number>]));

  for (const message of messages) {
    const families = totals.get(localDayKey(message.at));
    if (!families) continue;
    const family = familyOf(message.model);
    families[family] = (families[family] ?? 0) + workTokens(message);
  }
  return keys.map((day) => ({ day, families: totals.get(day) ?? {} }));
}
