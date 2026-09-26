import { MAX_ASK_PROJECTS } from './action-reply.ts';
import type { AskReply, Project, Proposal, ProposalRunner, RunOffer } from './route-contract.ts';
import { type Shell, commandsFor } from './shell-commands.ts';

/** Work to propose: `prompt`, in `project` when one is named. */
export interface ProposalRequest {
  readonly prompt: string;
  readonly project: Project | null;
  readonly projects: readonly Project[];
}

/** Tier 3: work is only ever proposed, as a command, and on the local site as
 *  a run the owner confirms. */
export interface Proposer {
  /** With no project named, asks which checkout rather than guessing a folder. */
  propose(request: ProposalRequest): Promise<Proposal | AskReply>;
  /** A skill's words are fixed, so no project in them could have been
   *  misheard: it takes the only checkout there is without asking. */
  proposeSkill(request: ProposalRequest): Promise<Proposal | AskReply>;
}

export interface ProposerOptions {
  /** The shells a command is written for. */
  readonly shells: readonly Shell[];
  /** Null where nothing can run a proposal: it is then only its command. */
  readonly runner: ProposalRunner | null;
}

/** The checkout to take without asking, among those the runner offered, or null to ask. */
type CheckoutChooser = (named: Project | null, offered: readonly Project[]) => Project | null;

const alwaysAsk: CheckoutChooser = () => null;
const takeTheOnlyOne: CheckoutChooser = (named, offered) =>
  !named && offered.length === 1 ? offered[0] : null;

const NO_PROJECT_NAMED = 'No project was named, so Home can only show the command.';

const whichCheckout = (offered: readonly Project[]): AskReply => ({
  tier: 3,
  question: 'Which project should this run in?',
  ask: offered.slice(0, MAX_ASK_PROJECTS).map((each) => ({
    label: each.name,
    pick: { tier: 3, project: each.name },
  })),
});

const offeredProjects = (offer: RunOffer, projects: readonly Project[]): Project[] =>
  offer.choose ? projects.filter((each) => offer.choose?.includes(each.repo)) : [];

export function proposer(options: ProposerOptions): Proposer {
  const { shells, runner } = options;

  async function proposeWith(
    choose: CheckoutChooser,
    request: ProposalRequest,
  ): Promise<Proposal | AskReply> {
    const { prompt, project, projects } = request;
    const commands = commandsFor(prompt, shells);
    const proposal: Proposal = {
      tier: 3,
      prompt,
      command: commands[0].command,
      commands,
      project: project?.name ?? null,
    };
    if (!runner) return proposal;
    const offer = await runner.offer({ prompt, repo: project?.repo ?? null });
    if (offer.run) return { ...proposal, run: offer.run };
    const offered = offeredProjects(offer, projects);
    const taken = choose(project, offered);
    if (taken) return proposeWith(alwaysAsk, { ...request, project: taken });
    if (offered.length) return whichCheckout(offered);
    return { ...proposal, runWhy: offer.why ?? NO_PROJECT_NAMED };
  }

  return {
    propose: (request) => proposeWith(alwaysAsk, request),
    proposeSkill: (request) => proposeWith(takeTheOnlyOne, request),
  };
}
