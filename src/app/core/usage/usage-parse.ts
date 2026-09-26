import type {
  LimitWindow,
  ModelUsage,
  PastWeek,
  ProjectUsage,
  TokenDay,
  TokenTotals,
  ToolCount,
  UsageLimits,
  WeekProjection,
} from './usage-document';

// The pieces of the usage report, each read on its own so one malformed part
// is dropped without taking the rest with it.

export type Json = Record<string, unknown>;

export const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export const isString = (value: unknown): value is string => typeof value === 'string';

/** A count the report may leave out: missing or malformed reads as none. */
const count = (value: unknown): number => (isFiniteNumber(value) ? value : 0);

/** Every item of `value` that parses, in order. */
export function listOf<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  return Array.isArray(value)
    ? value.map(parse).filter((item): item is T => item !== null && item !== undefined)
    : [];
}

function parseProjection(value: unknown): WeekProjection | undefined {
  if (!isObject(value) || !isFiniteNumber(value['atReset'])) return undefined;
  const fullAt = value['fullAt'];
  return {
    atReset: value['atReset'],
    perHour: isFiniteNumber(value['perHour']) ? value['perHour'] : undefined,
    fullAt: isString(fullAt) ? fullAt : undefined,
  };
}

const parsePoint = (point: unknown): [number, number] | null =>
  Array.isArray(point) && isFiniteNumber(point[0]) && isFiniteNumber(point[1])
    ? [point[0], point[1]]
    : null;

export function parseWindow(value: unknown): LimitWindow | undefined {
  if (!isObject(value) || !isFiniteNumber(value['pct']) || !isString(value['resetsAt'])) {
    return undefined;
  }
  return {
    pct: value['pct'],
    resetsAt: value['resetsAt'],
    expired: value['expired'] === true,
    points: listOf(value['points'], parsePoint),
    projection: parseProjection(value['projection']),
    startsAt: isString(value['startsAt']) ? value['startsAt'] : undefined,
  };
}

const parsePastWeek = (value: unknown): PastWeek | null =>
  isObject(value) && isString(value['resetsAt']) && isFiniteNumber(value['peak'])
    ? { resetsAt: value['resetsAt'], peak: value['peak'] }
    : null;

export const parseLimits = (limits: Json): UsageLimits => ({
  at: isString(limits['at']) ? limits['at'] : undefined,
  five: parseWindow(limits['five']),
  week: parseWindow(limits['week']),
  weeks: listOf(limits['weeks'], parsePastWeek),
});

export function parseTokenDay(value: unknown): TokenDay | null {
  if (!isObject(value) || !isString(value['day'])) return null;
  const families = isObject(value['families']) ? value['families'] : {};
  return {
    day: value['day'],
    families: Object.fromEntries(
      Object.entries(families).filter((entry): entry is [string, number] =>
        isFiniteNumber(entry[1]),
      ),
    ),
    cacheRead: count(value['cacheRead']),
    messages: count(value['messages']),
    sessions: count(value['sessions']),
    toolCalls: count(value['toolCalls']),
    subagents: count(value['subagents']),
  };
}

export function parseTotals(value: unknown): TokenTotals {
  const totals = isObject(value) ? value : {};
  return {
    tokens: count(totals['tokens']),
    cacheRead: count(totals['cacheRead']),
    messages: count(totals['messages']),
    sessions: count(totals['sessions']),
    toolCalls: count(totals['toolCalls']),
    subagents: count(totals['subagents']),
  };
}

export const parseModel = (value: unknown): ModelUsage | null =>
  isObject(value) && isString(value['model'])
    ? {
        model: value['model'],
        family: isString(value['family']) ? value['family'] : 'other',
        input: count(value['input']),
        output: count(value['output']),
        cacheRead: count(value['cacheRead']),
        cacheWrite: count(value['cacheWrite']),
        messages: count(value['messages']),
      }
    : null;

export const parseTool = (value: unknown): ToolCount | null =>
  isObject(value) && isString(value['name']) && isFiniteNumber(value['count'])
    ? { name: value['name'], count: value['count'] }
    : null;

export const parseProject = (value: unknown): ProjectUsage | null =>
  isObject(value) && isString(value['name'])
    ? {
        name: value['name'],
        repo: isString(value['repo']) ? value['repo'] : null,
        tokens: count(value['tokens']),
        cacheRead: count(value['cacheRead']),
        messages: count(value['messages']),
        sessions: count(value['sessions']),
      }
    : null;
