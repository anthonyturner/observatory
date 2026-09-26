import type { IssueDetailReader, IssueReader } from '../github/issue-reader.ts';
import { numberFrom } from '../http/number-from.ts';
import { type IssueRow, issueRowOf, openedBy } from './issues-report.ts';

/** A description past this many characters is cut, as pr-starmap cuts it. */
const BODY_LIMIT = 60 * 1024;

/** What `GET /api/issue` returns: the list's row with the full title and the
 *  description, as pr-starmap's `issues/<n>` document holds it. */
export interface IssueDetail extends IssueRow {
  readonly body: string;
  /** The description was cut to fit. */
  readonly bodyTruncated: boolean;
  readonly fetchedAt: string;
}

/** One issue, open or closed, with the pull requests linked to it. */
export async function issueDetail(
  github: IssueReader & IssueDetailReader,
  repo: string,
  number: number,
  now = Date.now(),
): Promise<IssueDetail> {
  const [issue, pulls] = await Promise.all([
    github.issueDetail(repo, number),
    github.closingPulls(repo),
  ]);
  const body = issue.body ?? '';
  return {
    ...issueRowOf(issue, openedBy(pulls)),
    title: issue.title,
    body: body.slice(0, BODY_LIMIT),
    bodyTruncated: body.length > BODY_LIMIT,
    fetchedAt: new Date(now).toISOString(),
  };
}

/** An issue number from a request, or a BadRequest. */
export const issueNumberFrom = (value: string | null): number =>
  numberFrom(value, 'an issue number');
