/** One limit window (the five-hour or the weekly), as pr-starmap records it. */
export interface LimitWindow {
  readonly pct: number;
  readonly resetsAt: string;
  readonly expired?: boolean;
  /** [epoch ms, percent] readings, oldest first. */
  readonly points: readonly (readonly [number, number])[];
  readonly projection?: { readonly atReset: number };
}

/** One day of tokens, split by model family. */
export interface TokenDay {
  readonly day: string;
  readonly families: Readonly<Record<string, number>>;
}

/** The parts of pr-starmap's `usage/current` document the meters read. */
export interface UsageDocument {
  readonly generatedAt: string;
  readonly limits?: {
    readonly at?: string;
    readonly five?: LimitWindow;
    readonly week?: LimitWindow;
  };
  readonly tokens?: { readonly rows: readonly TokenDay[] };
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';

function parseWindow(value: unknown): LimitWindow | undefined {
  if (!isObject(value) || !isFiniteNumber(value['pct']) || !isString(value['resetsAt'])) {
    return undefined;
  }
  const points = Array.isArray(value['points'])
    ? value['points'].filter(
        (point): point is [number, number] =>
          Array.isArray(point) && isFiniteNumber(point[0]) && isFiniteNumber(point[1]),
      )
    : [];
  const projection = isObject(value['projection']) ? value['projection'] : undefined;
  return {
    pct: value['pct'],
    resetsAt: value['resetsAt'],
    expired: value['expired'] === true,
    points,
    projection:
      projection && isFiniteNumber(projection['atReset'])
        ? { atReset: projection['atReset'] }
        : undefined,
  };
}

function parseTokenDay(value: unknown): TokenDay | null {
  if (!isObject(value) || !isString(value['day'])) return null;
  const families = isObject(value['families']) ? value['families'] : {};
  const counts = Object.fromEntries(
    Object.entries(families).filter((entry): entry is [string, number] => isFiniteNumber(entry[1])),
  );
  return { day: value['day'], families: counts };
}

/** Reads the document defensively: pr-starmap calls the session-log format
 *  internal, so any field may be missing or change. Whatever does not parse
 *  is left out, to show as unknown rather than as a wrong number. */
export function parseUsageDocument(value: unknown): UsageDocument | null {
  if (!isObject(value) || !isString(value['generatedAt'])) return null;
  const limits = isObject(value['limits']) ? value['limits'] : undefined;
  const tokens = isObject(value['tokens']) ? value['tokens'] : undefined;
  return {
    generatedAt: value['generatedAt'],
    limits: limits && {
      at: isString(limits['at']) ? limits['at'] : undefined,
      five: parseWindow(limits['five']),
      week: parseWindow(limits['week']),
    },
    tokens: tokens && {
      rows: Array.isArray(tokens['rows'])
        ? tokens['rows'].map(parseTokenDay).filter((row): row is TokenDay => row !== null)
        : [],
    },
  };
}
