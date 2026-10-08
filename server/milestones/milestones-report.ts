import type { DiscussionReader } from '../github/discussion-reader.ts';
import type { MilestoneMark, MilestoneReader } from '../github/milestone-reader.ts';
import type {
  DiscussionsPart,
  MilestoneView,
  MilestonesPart,
  MilestonesReport,
} from './milestones-types.ts';

/** A fine-grained token without "Discussions: read" is refused the field, not the repository. */
const REFUSED = /not accessible|forbidden|HTTP 40[13]\b/i;

const MILESTONES_FAILED = 'GitHub did not answer for the milestones. Try again in a moment.';
const DISCUSSIONS_FAILED = 'GitHub did not answer for the discussions. Try again in a moment.';
const DISCUSSIONS_REFUSED = 'This token is not allowed to read the discussions.';

const NO_DISCUSSIONS: Omit<DiscussionsPart, 'note'> = { isEnabled: false, total: 0, threads: [] };

const doneFirst = (a: MilestoneMark['items'][number], b: MilestoneMark['items'][number]): number =>
  Number(a.state !== 'open') - Number(b.state !== 'open') || b.number - a.number;

function viewOf(mark: MilestoneMark): MilestoneView {
  return {
    number: mark.number,
    title: mark.title,
    description: mark.description,
    url: mark.url,
    isOpen: mark.isOpen,
    dueOn: mark.dueOn,
    closedAt: mark.closedAt,
    open: mark.openIssues + mark.openPulls,
    closed: mark.closedIssues + mark.closedPulls,
    items: [...mark.items].sort(doneFirst),
  };
}

const timeOr = (iso: string | null, otherwise: number): number =>
  iso === null ? otherwise : Date.parse(iso);

/** Soonest due first, those with no due date last, then oldest first. */
export const byDueDate = (a: MilestoneView, b: MilestoneView): number =>
  timeOr(a.dueOn, Infinity) - timeOr(b.dueOn, Infinity) || a.number - b.number;

const byClosedLately = (a: MilestoneView, b: MilestoneView): number =>
  timeOr(b.closedAt, 0) - timeOr(a.closedAt, 0);

async function milestonesPart(github: MilestoneReader, repo: string): Promise<MilestonesPart> {
  try {
    const views = (await github.milestones(repo)).map(viewOf);
    return {
      note: null,
      open: views.filter((view) => view.isOpen).sort(byDueDate),
      closed: views.filter((view) => !view.isOpen).sort(byClosedLately),
    };
  } catch (error: unknown) {
    console.error(`Could not read ${repo}'s milestones:`, error);
    return { note: MILESTONES_FAILED, open: [], closed: [] };
  }
}

async function discussionsPart(github: DiscussionReader, repo: string): Promise<DiscussionsPart> {
  try {
    return { note: null, ...(await github.discussions(repo)) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (REFUSED.test(message)) return { note: DISCUSSIONS_REFUSED, ...NO_DISCUSSIONS };
    console.error(`Could not read ${repo}'s discussions:`, error);
    return { note: DISCUSSIONS_FAILED, ...NO_DISCUSSIONS };
  }
}

/** The Milestones screen's report. Each half is read on its own, so one GitHub refuses leaves the other. */
export async function milestonesReport(
  github: MilestoneReader & DiscussionReader,
  repo: string,
  now: number = Date.now(),
): Promise<MilestonesReport> {
  const [milestones, discussions] = await Promise.all([
    milestonesPart(github, repo),
    discussionsPart(github, repo),
  ]);
  return { generatedAt: new Date(now).toISOString(), repo, milestones, discussions };
}
