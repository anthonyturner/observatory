import { IssuesReport } from '../issues/issues-report';
import { Ledger } from './ledger';

/** How a piece of work finished. */
export type DoneKind = 'merged' | 'closed' | 'issue' | 'dropped';

/** One finished pull request or issue. */
export interface DoneItem {
  /** Unique across pull requests and issues, which share a number space. */
  readonly key: string;
  readonly kind: DoneKind;
  readonly number: number;
  readonly title: string;
  /** When it finished, in ms; a pull request is known only to the day, so noon. */
  readonly at: number;
  /** Its local day, YYYY-MM-DD, for grouping. */
  readonly day: string;
}

export const isPull = (item: DoneItem): boolean => item.kind === 'merged' || item.kind === 'closed';

const pad = (n: number): string => String(n).padStart(2, '0');
const localDay = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Everything finished in the ledger's window, newest first: pull requests
 * merged or closed unmerged, from the ledger's rows, and issues closed, from
 * the issues report. An issue closed as not planned or a duplicate is dropped.
 */
export function doneWork(ledger: Ledger | null, issues: IssuesReport | null): DoneItem[] {
  const pulls = (ledger?.rows ?? []).flatMap((row) => {
    const at = new Date(`${row.day}T12:00:00`).getTime();
    const pull = (kind: DoneKind) => (number: number) => ({
      key: `pr${number}`,
      kind,
      number,
      title: ledger?.titles[String(number)] ?? `Pull request ${number}`,
      at,
      day: row.day,
    });
    return [...row.merged.map(pull('merged')), ...row.closed.map(pull('closed'))];
  });
  const closed = (issues?.closed ?? []).flatMap((issue) => {
    if (!issue.closedAt) return [];
    const at = Date.parse(issue.closedAt);
    const kind: DoneKind =
      issue.stateReason === 'COMPLETED' || !issue.stateReason ? 'issue' : 'dropped';
    return [
      {
        key: `issue${issue.number}`,
        kind,
        number: issue.number,
        title: issue.title,
        at,
        day: localDay(at),
      },
    ];
  });
  return [...pulls, ...closed].sort((a, b) => b.at - a.at || b.number - a.number);
}
