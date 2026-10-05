import { Ledger } from '../queue/ledger';

/** One pull request merged in a project the Orrery shows. */
export interface ShippedItem {
  /** Unique across projects. */
  readonly key: string;
  readonly repo: string;
  readonly number: number;
  readonly title: string;
  /** When it merged: a ledger knows only the day, so noon of it. */
  readonly at: number;
}

/** Every pull request merged in the ledgers' window, across projects, newest first. */
export function shippedWork(ledgers: ReadonlyMap<string, Ledger>): ShippedItem[] {
  return [...ledgers.entries()]
    .flatMap(([repo, ledger]) =>
      ledger.rows.flatMap((row) =>
        row.merged.map((number) => ({
          key: `${repo}#${number}`,
          repo,
          number,
          title: ledger.titles[String(number)] ?? `Pull request ${number}`,
          at: new Date(`${row.day}T12:00:00`).getTime(),
        })),
      ),
    )
    .sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}
