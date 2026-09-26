import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { AskFeed } from '../assistant/ask-feed';
import { ProposalSlot, RunProposal } from '../assistant/proposal';
import { noting } from '../assistant/reply-entry';
import { ReplyLog } from '../assistant/reply-log';
import { ReplySpeech } from '../assistant/reply-speech';
import { Clock } from '../time/clock';
import { RunDock } from './run-dock';
import { RUNNER_BUSY, RUNS_REFUSED, messageOf, statusOf } from './runs-api';
import { RunsStore } from './runs-store';

/** Run arms over this long, so a doubled click or Enter cannot start a run. */
export const ARM_MS = 700;

const NO_LONGER_VALID =
  'Home couldn’t start this run: the proposal was no longer valid. Send the request again.';

/** Why Run cannot be pressed, and the one thing to do about it. */
export interface OfferBlock {
  readonly text: string;
  readonly isBad: boolean;
  readonly actionLabel: string;
  readonly action: 'propose-again' | 'show-run';
}

const EXPIRED: OfferBlock = {
  text: 'This proposal expired. Send the request again.',
  isBad: false,
  actionLabel: 'Propose again',
  action: 'propose-again',
};

const BUSY: OfferBlock = {
  text: 'A run is already going. Cancel it or wait.',
  isBad: false,
  actionLabel: 'Show the run',
  action: 'show-run',
};

/**
 * One proposal card's way to a run. Run needs a click, or Enter or Space on
 * Run itself, after it arms; nothing else starts it. The runner checks the
 * token again, so this is a courtesy, not the lock. Provided by each card, so
 * its timers end with it.
 */
@Injectable()
export class RunOffer {
  private readonly store = inject(RunsStore);
  private readonly dock = inject(RunDock);
  private readonly feed = inject(AskFeed);
  private readonly slot = inject(ProposalSlot);
  private readonly log = inject(ReplyLog);
  private readonly speech = inject(ReplySpeech);
  private readonly clock = inject(Clock);
  private readonly armed = signal(false);
  private readonly starting = signal(false);
  private readonly expired = signal(false);
  private readonly refusal = signal<string | null>(null);
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private proposal: RunProposal | null = null;
  private isGone = false;

  readonly isArmed = this.armed.asReadonly();
  readonly isStarting = this.starting.asReadonly();
  readonly block = computed<OfferBlock | null>(() => {
    if (this.expired()) return EXPIRED;
    const refusal = this.refusal();
    if (refusal) return { ...EXPIRED, text: refusal, isBad: true };
    return this.store.isLive() && !this.starting() ? BUSY : null;
  });
  readonly canRun = computed(() => !this.block() && this.armed() && !this.starting());

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.isGone = true;
      for (const timer of this.timers) clearTimeout(timer);
    });
  }

  /** Arms Run after `ARM_MS`, and expires the offer with its token. */
  offer(proposal: RunProposal): void {
    this.proposal = proposal;
    const expiresIn = Math.max(0, proposal.ticket.expiresAt - this.clock.now().getTime());
    this.timers.push(setTimeout(() => this.armed.set(true), ARM_MS));
    this.timers.push(setTimeout(() => this.expire(proposal), expiresIn));
  }

  async run(): Promise<void> {
    const proposal = this.proposal;
    if (!proposal || !this.canRun()) return;
    this.speech.stop();
    this.starting.set(true);
    const { token, folder } = proposal.ticket;
    try {
      await this.store.start({ token, prompt: proposal.prompt, folder });
      this.started(proposal);
    } catch (error: unknown) {
      if (!this.isGone) await this.refused(error);
    }
  }

  leave(): void {
    if (this.proposal) this.feed.leaveProposal(this.proposal.entryId);
  }

  pressBlock(): void {
    if (this.block()?.action === 'show-run') this.dock.show();
    else if (this.proposal) this.feed.proposeAgain(this.proposal);
  }

  private started(proposal: RunProposal): void {
    if (this.slot.proposal() === proposal) this.slot.dismiss();
    this.log.say(proposal.entryId, noting('Ran it: the task panel shows its output.'));
    this.dock.show();
  }

  /** A busy runner keeps the token: once the other run ends, Run works again. */
  private async refused(error: unknown): Promise<void> {
    this.starting.set(false);
    const status = statusOf(error);
    if (status === RUNNER_BUSY) return this.store.refresh();
    this.refusal.set(
      status === RUNS_REFUSED
        ? NO_LONGER_VALID
        : `Home couldn’t start this run: ${messageOf(error)}.`,
    );
  }

  private expire(proposal: RunProposal): void {
    this.expired.set(true);
    this.log.say(proposal.entryId, noting('Expired.'));
  }
}
