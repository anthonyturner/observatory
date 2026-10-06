import type { ProposalRunner, RunTicket } from '../assistant/route-contract.ts';
import type { MergedBranch } from '../history/ledger.ts';
import { Forbidden, NotFound } from '../http/api-handler.ts';
import type { QueueItem, QueueReport } from '../queue/queue-report.ts';
import { type CrewTarget, crewPrompt, crewTaskOf, isSafeBranch } from './crew-prompt.ts';
import { type LandedBase, landedBaseOf } from './landed-base.ts';

/** The queue as a crew reads it: afresh, so a branch fixed a minute ago is not sent a crew. */
export interface CrewQueue {
  queue(repo: string): Promise<QueueReport>;
  forgetQueue(repo: string): void;
  /** The repository's recent merges, which tell a branch stacked on a merged one. */
  ledger(repo: string): Promise<{ readonly mergedBranches: readonly MergedBranch[] }>;
}

/** The runner as a crew needs it: whether there is one, and a proposal from it. */
export interface CrewRunner extends ProposalRunner {
  readonly isAvailable: boolean;
}

/** A crew ready to launch: the page starts it through `POST /api/runs`, word for word. */
export interface CrewProposal {
  readonly prompt: string;
  readonly run: RunTicket;
}

const NOT_OPEN = 'that pull request is not open in the queue';
const NOT_STUCK =
  'only a conflicted or failing pull request, or one whose base has merged, can be sent a crew';
const UNSAFE_BRANCH = 'its branch names cannot be written into a crew’s instructions safely';
const NO_RUN = 'this machine cannot start a crew';

/** `target`, once every branch it names is safe to write into the instructions. */
function checked(target: CrewTarget): CrewTarget {
  const into = target.task === 'update-stack' ? [target.landed.into] : [];
  if (![target.branch, target.base, ...into].every(isSafeBranch)) {
    throw new Forbidden(UNSAFE_BRANCH);
  }
  return target;
}

/** A base that has merged comes first: clearing a branch against a finished one helps nothing. */
function targetOf(repo: string, item: QueueItem, landed: LandedBase | null): CrewTarget {
  const branches = { repo, number: item.number, branch: item.branch, base: item.base };
  if (landed) return checked({ ...branches, task: 'update-stack', landed });
  const task = crewTaskOf(item.bucket);
  if (!task) throw new Forbidden(NOT_STUCK);
  return checked({ ...branches, task });
}

/** A crew's instructions for pull request `number`, and the runner's token to start them. */
export async function proposeCrew(
  sources: { readonly queue: CrewQueue; readonly runner: CrewRunner },
  repo: string,
  number: number,
): Promise<CrewProposal> {
  sources.queue.forgetQueue(repo);
  const [{ items }, { mergedBranches }] = await Promise.all([
    sources.queue.queue(repo),
    sources.queue.ledger(repo),
  ]);
  const item = items.find((each) => each.number === number);
  if (!item) throw new NotFound(NOT_OPEN);
  const prompt = crewPrompt(targetOf(repo, item, landedBaseOf(item, items, mergedBranches)));
  const offer = await sources.runner.offer({ prompt, repo });
  if (!offer.run) throw new Forbidden(offer.why ?? NO_RUN);
  return { prompt, run: offer.run };
}
