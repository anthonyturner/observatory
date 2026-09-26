import { IssuesReport } from '../../core/issues/issues-report';
import { COMET_COLOUR } from '../issues/issue-inks';

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
export { COMET_COLOUR };

const DAY_MS = 86_400_000;
const daysSince = (iso: string, now: number): number =>
  Math.floor((now - Date.parse(iso)) / DAY_MS);

/** The report's unclaimed issues as comets, idlest first, as pr-starmap lists them. */
export function cometsOf(report: IssuesReport | null, now: number): Comet[] {
  return (report?.open ?? [])
    .filter((issue) => issue.comet)
    .map((issue) => ({
      issue: issue.number,
      title: issue.title,
      url: issue.url,
      labels: issue.labels.map((label) => label.name),
      ageDays: daysSince(issue.createdAt, now),
      idleDays: daysSince(issue.updatedAt, now),
    }))
    .sort((a, b) => b.idleDays - a.idleDays || a.issue - b.issue);
}
