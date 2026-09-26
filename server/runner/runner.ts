import { Forbidden, NotFound } from '../http/api-handler.ts';
import type { Launch } from './claude-launcher.ts';
import { RUN_COMMAND } from './claude-command.ts';
import type { CheckoutRegistry } from './checkouts.ts';
import { ClaudeRun, type RunSummary } from './claude-run.ts';
import type { ProcessTreeKiller } from './process-tree.ts';
import { ProposalBook, type Proposal, type ProposalToken, type StartRequest } from './proposals.ts';
import { RUN_LIMITS, type RunLimits } from './run-limits.ts';
import { RunList, type RunsReport } from './run-list.ts';
import type { LogFollower } from './run-log.ts';

/** A tier-3 request the assistant would like to run. */
export interface RunOfferRequest {
  readonly prompt: string;
  /** The project to run it in; null when the request did not say. */
  readonly repo: string | null;
}

/** A token to run it; or, with no repo, the repos it could run in; or why it cannot run here. */
export interface RunOffer {
  readonly run?: ProposalToken;
  readonly choose?: string[];
  readonly why?: string;
}

/** What the assistant's router needs of the runner. */
export interface RunOfferer {
  offer(request: RunOfferRequest): Promise<RunOffer>;
}

/** What the runs routes need of the runner. */
export interface RunControl {
  start(request: StartRequest): Promise<RunSummary>;
  cancel(id: string): RunSummary;
  report(): RunsReport;
  has(id: string): boolean;
  follow(id: string, from: number, follower: LogFollower): () => void;
}

/** Thrown when a run is asked to start while another is going. */
export class RunnerBusy extends Error {
  readonly runId: string;

  constructor(runId: string) {
    super('a run is already going');
    this.runId = runId;
  }
}

/** What a runner is made from; tests give fakes for all of it. */
export interface RunnerDependencies {
  /** Null when Claude Code is not installed: every offer then says why. */
  readonly launch: Launch | null;
  readonly killer: ProcessTreeKiller;
  readonly checkouts: CheckoutRegistry;
  readonly clock: () => number;
  readonly limits?: RunLimits;
}

const NO_CLAUDE = 'Claude Code isn’t on this machine’s PATH, so Home can only show the command.';
const NO_CHECKOUTS = 'No project has a local checkout to run it in.';
const NO_CHECKOUT_FOR_REPO =
  'That project has no local checkout on this machine, so Home can only show the command.';
const NOT_A_CHECKOUT = 'that folder is no longer a local checkout';

/**
 * Tier 3 on this machine: a proposal the owner confirmed runs as `claude -p` in
 * one project's checkout, one run at a time
 * (docs/decisions/0005-run-tier-3-tasks-on-the-local-site-only.md).
 */
export class Runner implements RunOfferer, RunControl {
  private readonly limits: RunLimits;
  private readonly proposals: ProposalBook;
  private readonly runs: RunList;
  private readonly dependencies: RunnerDependencies;

  constructor(dependencies: RunnerDependencies) {
    this.dependencies = dependencies;
    this.limits = dependencies.limits ?? RUN_LIMITS;
    this.proposals = new ProposalBook({ ...this.limits, command: RUN_COMMAND }, dependencies.clock);
    this.runs = new RunList(this.limits.recent);
  }

  get isAvailable(): boolean {
    return this.dependencies.launch !== null;
  }

  async offer({ prompt, repo }: RunOfferRequest): Promise<RunOffer> {
    if (!this.isAvailable) return { why: NO_CLAUDE };
    const checkouts = await this.dependencies.checkouts.list();
    if (!checkouts.length) return { why: NO_CHECKOUTS };
    if (repo === null) return { choose: checkouts.map((checkout) => checkout.repo) };
    const wanted = repo.toLowerCase();
    const checkout = checkouts.find((each) => each.repo.toLowerCase() === wanted);
    return checkout
      ? { run: this.proposals.issue(prompt, checkout) }
      : { why: NO_CHECKOUT_FOR_REPO };
  }

  /** Starts the run a proposal described, if its token still stands. A busy
   *  runner keeps the token: the proposal can still run once this one ends. */
  async start(request: StartRequest): Promise<RunSummary> {
    const launch = this.dependencies.launch;
    if (!launch) throw new Forbidden(NO_CLAUDE);
    const proposal = this.proposals.vet(request);
    this.refuseWhileBusy();
    this.proposals.spend(request.token);
    if (!(await this.isCheckout(proposal.folder))) throw new Forbidden(NOT_A_CHECKOUT);
    this.refuseWhileBusy();
    return this.begin(launch, proposal);
  }

  /** Stops run `id`, and everything it started. */
  cancel(id: string): RunSummary {
    const run = this.find(id);
    run.stop('cancelled');
    return run.summary();
  }

  /** Kills a live run at once: for the server's own exit. */
  shutdown(): void {
    this.runs.current?.stopNow();
  }

  report(): RunsReport {
    return this.runs.report();
  }

  has(id: string): boolean {
    return this.runs.find(id) !== undefined;
  }

  follow(id: string, from: number, follower: LogFollower): () => void {
    return this.find(id).log.follow(from, follower);
  }

  private find(id: string): ClaudeRun {
    const run = this.runs.find(id);
    if (!run) throw new NotFound('no such run');
    return run;
  }

  private refuseWhileBusy(): void {
    const current = this.runs.current;
    if (current) throw new RunnerBusy(current.id);
  }

  private async isCheckout(folder: string): Promise<boolean> {
    return (await this.dependencies.checkouts.list()).some((each) => each.folder === folder);
  }

  private begin(launch: Launch, proposal: Proposal): RunSummary {
    const run = new ClaudeRun(
      {
        launch,
        killer: this.dependencies.killer,
        clock: this.dependencies.clock,
        limits: this.limits,
        onEnd: (ended) => this.runs.ended(ended),
      },
      proposal,
    );
    this.runs.add(run);
    run.begin();
    return run.summary();
  }
}
