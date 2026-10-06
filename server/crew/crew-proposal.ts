import type { ProposalRunner, RunTicket } from '../assistant/route-contract.ts';
import { Forbidden, NotFound } from '../http/api-handler.ts';
import type { QueueItem, QueueReport } from '../queue/queue-report.ts';
import { type CrewTarget, crewPrompt, crewTaskOf, isSafeBranch } from './crew-prompt.ts';

/** The queue as a crew reads it: afresh, so a branch fixed a minute ago is not sent a crew. */
export interface CrewQueue {
  queue(repo: string): Promise<QueueReport>;
  forgetQueue(repo: string): void;
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
const NOT_STUCK = 'only a conflicted or failing pull request can be sent a crew';
const UNSAFE_BRANCH = 'its branch names cannot be written into a crew’s instructions safely';
const NO_RUN = 'this machine cannot start a crew';

function targetOf(repo: string, item: QueueItem): CrewTarget {
  const task = crewTaskOf(item.bucket);
  if (!task) throw new Forbidden(NOT_STUCK);
  if (!isSafeBranch(item.branch) || !isSafeBranch(item.base)) throw new Forbidden(UNSAFE_BRANCH);
  return { repo, number: item.number, branch: item.branch, base: item.base, task };
}

/** A crew's instructions for pull request `number`, and the runner's token to start them. */
export async function proposeCrew(
  sources: { readonly queue: CrewQueue; readonly runner: CrewRunner },
  repo: string,
  number: number,
): Promise<CrewProposal> {
  sources.queue.forgetQueue(repo);
  const item = (await sources.queue.queue(repo)).items.find((each) => each.number === number);
  if (!item) throw new NotFound(NOT_OPEN);
  const prompt = crewPrompt(targetOf(repo, item));
  const offer = await sources.runner.offer({ prompt, repo });
  if (!offer.run) throw new Forbidden(offer.why ?? NO_RUN);
  return { prompt, run: offer.run };
}
