import type { QueueReader } from '../github/queue-reader.ts';

/** A pull request touched in the ledger's window, as `gh pr list --json` gives it. */
export interface LedgerPull {
  readonly number: number;
  readonly title: string;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly mergedAt: string | null;
  /** `OPEN`, `CLOSED` or `MERGED`. */
  readonly state: string;
}

/** The `gh --json` fields a LedgerPull holds. */
export const LEDGER_PULL_FIELDS: readonly string[] = [
  'number',
  'title',
  'createdAt',
  'closedAt',
  'mergedAt',
  'state',
];

/** Newest number first, so every reader lists the same pull requests the same way. */
export const byNumberDescending = <T extends { readonly number: number }>(
  pulls: readonly T[],
): T[] => [...pulls].sort((a, b) => b.number - a.number);

/** What the ledger needs from GitHub. */
export interface LedgerReader {
  /** Every pull request, open or not, updated on or after `sinceDay` (YYYY-MM-DD). */
  touchedPulls(repo: string, sinceDay: string): Promise<LedgerPull[]>;
}

/** One day of the ledger: how many were open, and which opened, merged and closed. */
export interface LedgerRow {
  readonly day: string;
  readonly open: number;
  readonly opened: readonly number[];
  readonly merged: readonly number[];
  readonly closed: readonly number[];
}

/** What `GET /api/ledger` returns. */
export interface Ledger {
  readonly generatedAt: string;
  readonly days: number;
  readonly rows: readonly LedgerRow[];
  /** Titles of the pull requests the rows mention, for the timeline's tip. */
  readonly titles: Readonly<Record<string, string>>;
}

export const LEDGER_DAYS = 60;
const DAY_MS = 86_400_000;
const TITLE_MAX = 90;

const clip = (title: string): string =>
  title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;

/** A local calendar day, as pr-starmap keys its rows. */
export const localDay = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Placed {
  readonly pr: number;
  readonly title: string;
  readonly openedAt: string;
  readonly mergedAt: string | null;
  readonly closedAt: string | null;
}

/** When each pull request opened, merged and closed; a merge is also its close. */
const placed = (pull: LedgerPull): Placed => ({
  pr: pull.number,
  title: clip(pull.title),
  openedAt: pull.createdAt,
  mergedAt: pull.mergedAt || null,
  closedAt: pull.state === 'OPEN' ? null : pull.mergedAt || pull.closedAt || null,
});

/** The last `days` days, one row each: pr-starmap's `ledgerFrom`, pure. */
export function ledgerRows(
  pulls: readonly LedgerPull[],
  now: number,
  days = LEDGER_DAYS,
): { rows: LedgerRow[]; titles: Record<string, string> } {
  const prs = pulls.map(placed);
  const since = now - days * DAY_MS;
  const rows: LedgerRow[] = [];
  for (let t = since; t <= now + 1; t += DAY_MS) {
    const day = localDay(t);
    const end = new Date(`${day}T23:59:59.999`).getTime();
    const start = new Date(`${day}T00:00:00`).getTime();
    const inDay = (iso: string | null): boolean =>
      !!iso && Date.parse(iso) >= start && Date.parse(iso) <= end;
    rows.push({
      day,
      open: prs.filter(
        (p) => Date.parse(p.openedAt) <= end && (!p.closedAt || Date.parse(p.closedAt) > end),
      ).length,
      opened: prs.filter((p) => inDay(p.openedAt)).map((p) => p.pr),
      merged: prs.filter((p) => inDay(p.mergedAt)).map((p) => p.pr),
      closed: prs.filter((p) => !p.mergedAt && inDay(p.closedAt)).map((p) => p.pr),
    });
  }
  // Titles only for the pull requests the rows mention, which is all a tip needs.
  const named = new Set(rows.flatMap((r) => [...r.opened, ...r.merged, ...r.closed]));
  const titles = Object.fromEntries(
    prs.filter((p) => named.has(p.pr)).map((p) => [String(p.pr), p.title]),
  );
  return { rows, titles };
}

/**
 * The ledger, rebuilt from GitHub on every read, so it needs no stored state
 * and is complete from the first read. A pull request opened before the window
 * and untouched throughout is still open; the open list covers it.
 */
export async function ledgerReport(
  github: LedgerReader & QueueReader,
  repo: string,
  now = Date.now(),
  days = LEDGER_DAYS,
): Promise<Ledger> {
  const [touched, open] = await Promise.all([
    github.touchedPulls(repo, localDay(now - days * DAY_MS)),
    github.queuePulls(repo),
  ]);
  const openNow: LedgerPull[] = open.map((p) => ({
    number: p.number,
    title: p.title,
    createdAt: p.createdAt,
    closedAt: null,
    mergedAt: null,
    state: 'OPEN',
  }));
  const byNumber = new Map([...openNow, ...touched].map((p) => [p.number, p]));
  const { rows, titles } = ledgerRows([...byNumber.values()], now, days);
  return { generatedAt: new Date(now).toISOString(), days, rows, titles };
}
