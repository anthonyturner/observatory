/** One day of the ledger: how many were open, and which opened, merged and closed. */
export interface LedgerRow {
  readonly day: string;
  readonly open: number;
  readonly opened: readonly number[];
  readonly merged: readonly number[];
  readonly closed: readonly number[];
}

/** A pull request that merged or closed in the ledger's window, timed to the second. */
export interface FinishedPull {
  readonly number: number;
  readonly openedAt: number;
  readonly finishedAt: number;
  readonly fate: 'merged' | 'closed';
}

/** A merged pull request's branches: one still stacked on its head needs updating. */
export interface MergedBranch {
  readonly number: number;
  readonly head: string;
  readonly base: string;
}

/** What `GET /api/ledger` returns: sixty days rebuilt from GitHub. */
export interface Ledger {
  readonly generatedAt: string;
  readonly rows: readonly LedgerRow[];
  readonly titles: Readonly<Record<string, string>>;
  readonly finished: readonly FinishedPull[];
  /** The merges whose branch is finished, newest first. */
  readonly mergedBranches: readonly MergedBranch[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;
const isBranch = (value: unknown): value is string => typeof value === 'string' && value !== '';
const numbers = (value: unknown): number[] => (Array.isArray(value) ? value.filter(isNumber) : []);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseRow(value: unknown): LedgerRow | null {
  if (!isObject(value) || typeof value['day'] !== 'string' || !DAY.test(value['day'])) return null;
  const open = value['open'];
  return {
    day: value['day'],
    open: typeof open === 'number' && open >= 0 ? open : 0,
    opened: numbers(value['opened']),
    merged: numbers(value['merged']),
    closed: numbers(value['closed']),
  };
}

const timeOf = (value: unknown): number => (typeof value === 'string' ? Date.parse(value) : NaN);

/** One finished pull request, or null if it is not one or finished before it opened. */
function parseFinished(value: unknown): FinishedPull | null {
  if (!isObject(value)) return null;
  const { number, fate } = value;
  const openedAt = timeOf(value['openedAt']);
  const finishedAt = timeOf(value['finishedAt']);
  if (!isNumber(number) || (fate !== 'merged' && fate !== 'closed')) return null;
  if (!Number.isFinite(openedAt) || !(finishedAt >= openedAt)) return null;
  return { number, openedAt, finishedAt, fate };
}

function parseMergedBranch(value: unknown): MergedBranch | null {
  if (!isObject(value)) return null;
  const { number, head, base } = value;
  return isNumber(number) && isBranch(head) && isBranch(base) ? { number, head, base } : null;
}

/** The ledger read defensively: a row or merge that does not parse is left out. */
export function parseLedger(value: unknown): Ledger | null {
  if (!isObject(value) || typeof value['generatedAt'] !== 'string' || !Array.isArray(value['rows']))
    return null;
  const titles = isObject(value['titles'])
    ? Object.fromEntries(
        Object.entries(value['titles']).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};
  const merges = Array.isArray(value['mergedBranches']) ? value['mergedBranches'] : [];
  return {
    generatedAt: value['generatedAt'],
    rows: value['rows'].map(parseRow).filter((row): row is LedgerRow => row !== null),
    titles,
    finished: Array.isArray(value['finished'])
      ? value['finished'].map(parseFinished).filter((pull): pull is FinishedPull => pull !== null)
      : [],
    mergedBranches: merges
      .map(parseMergedBranch)
      .filter((merge): merge is MergedBranch => merge !== null),
  };
}
