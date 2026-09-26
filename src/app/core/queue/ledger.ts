/** One day of the ledger: how many were open, and which opened, merged and closed. */
export interface LedgerRow {
  readonly day: string;
  readonly open: number;
  readonly opened: readonly number[];
  readonly merged: readonly number[];
  readonly closed: readonly number[];
}

/** What `GET /api/ledger` returns: sixty days rebuilt from GitHub. */
export interface Ledger {
  readonly generatedAt: string;
  readonly rows: readonly LedgerRow[];
  readonly titles: Readonly<Record<string, string>>;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const numbers = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
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

/** The ledger read defensively: a row that does not parse is left out. */
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
  return {
    generatedAt: value['generatedAt'],
    rows: value['rows'].map(parseRow).filter((row): row is LedgerRow => row !== null),
    titles,
  };
}
