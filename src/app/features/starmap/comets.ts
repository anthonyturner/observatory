import { IssuesReport } from '../../core/issues/issues-report';

/** An open issue no open pull request closes: a comet passing through the sky. */
export interface Comet {
  readonly issue: number;
  readonly title: string;
  readonly url: string;
  readonly labels: readonly string[];
  readonly ageDays: number;
  readonly idleDays: number;
}

/** At most this many are drawn, idlest first; the legend counts them all. */
export const COMET_CAP = 40;
export const COMET_COLOUR = '#9fe8ff';

/** The report's unclaimed issues as comets, idlest first, as pr-starmap lists them. */
export function cometsOf(report: IssuesReport | null): Comet[] {
  return (report?.items ?? [])
    .filter((item) => item.pulls.length === 0)
    .map((item) => ({
      issue: item.number,
      title: item.title,
      url: item.url,
      labels: item.labels,
      ageDays: item.ageDays,
      idleDays: item.idleDays,
    }))
    .sort((a, b) => b.idleDays - a.idleDays || a.issue - b.issue);
}
