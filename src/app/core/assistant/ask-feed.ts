import { Injectable, Provider, computed, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ASK_CHANNEL, AskChannel } from './ask-channel';
import { AskBoxFocus } from './ask-box-focus';
import { AskOutcome, FAILED, outcomeOf } from './ask-outcome';
import { ASSISTANT_API, AssistantRefused } from './assistant-api';
import { AssistantInfo } from './assistant-info';
import { RouteReply, RouteRequest, Skill } from './assistant.types';
import { PageJump } from './page-jump';
import { ProposalSlot, commandProposalOf } from './proposal';
import { NO_ANSWER_CHIP, WAITING_CHIP, chipOf } from './reply-chip';
import { AskedHow, EntryAction, answering, noting, saying } from './reply-entry';
import { ReplyLog } from './reply-log';
import { ReplySpeech } from './reply-speech';
import { TierOneActions } from './tier-one-actions';
import { ReplyTier } from '../voice/reply-voice';

/**
 * Home's assistant: sends a request to the router and shows what it decided.
 * The router decides what a request is; the feed carries out app actions,
 * reads replies aloud, and puts a task up as a proposal. It never runs one.
 */
@Injectable({ providedIn: 'root' })
export class AskFeed implements AskChannel {
  private readonly api = inject(ASSISTANT_API);
  private readonly info = inject(AssistantInfo);
  private readonly log = inject(ReplyLog);
  private readonly speech = inject(ReplySpeech);
  private readonly actions = inject(TierOneActions);
  private readonly jump = inject(PageJump);
  private readonly proposals = inject(ProposalSlot);
  private readonly focus = inject(AskBoxFocus);
  private readonly asking = signal(false);
  private readonly skillAsking = signal<string | null>(null);
  private readonly ended = new Subject<AskOutcome>();
  /** Whether the last request cut a reply off, for "stop" to say so. */
  private cutSpeech = false;
  /** A spoken request keeps what the press that recorded it cut off. */
  private carriedCut = false;
  private proposalCount = 0;

  readonly busy = this.asking.asReadonly();
  readonly hasPendingJump = computed(() => this.jump.pending() !== null);
  /** The skill whose press is being worked out. */
  readonly pressedSkill = this.skillAsking.asReadonly();
  /** How each request ended, as it ends. */
  readonly outcomes: Observable<AskOutcome> = this.ended.asObservable();

  submit(text: string, options?: { readonly spoken?: boolean }): void {
    const asked = text.trim();
    if (!asked || this.asking()) return;
    const spoken = options?.spoken ?? false;
    this.carriedCut = spoken && this.cutSpeech;
    void this.send({ text: asked }, this.open(asked, spoken ? 'spoken' : 'typed'));
  }

  /** Sends only the skill's id: the router keeps its words, so a press can
   *  only ever propose what the skill says. Settles with its reply's id once
   *  the reply is shown, or null when a request was already on its way. */
  async pressSkill(skill: Skill): Promise<number | null> {
    if (this.asking()) return null;
    this.skillAsking.set(skill.id);
    const entryId = this.open(skill.label, 'skill');
    try {
      await this.send({ skill: skill.id }, entryId);
    } finally {
      this.skillAsking.set(null);
    }
    return entryId;
  }

  press(entryId: number, action: EntryAction): void {
    if (action.kind === 'send') void this.send(action.request, entryId);
    else if (action.kind === 'stay') this.stayHere();
    else this.leave(entryId);
  }

  /** Cancels a page jump still waiting, leaving a link to take it after all. */
  stayHere(): void {
    this.actions.stayHere();
  }

  stopSpeaking(): void {
    this.speech.stop();
    this.focus.request();
  }

  /** Follows the link Stay here left. */
  follow(url: string): void {
    this.jump.go(url);
  }

  dismissProposal(): void {
    this.proposals.dismiss();
    this.focus.request();
  }

  private open(asked: string, how: AskedHow): number {
    return this.log.open(asked, how);
  }

  private async send(request: RouteRequest, entryId: number): Promise<void> {
    if (this.asking()) return;
    this.asking.set(true);
    this.startWaiting(entryId);
    const startedAt = performance.now();
    try {
      const reply = await this.api.route(request);
      if (reply.jev) this.info.noteJev(reply.jev);
      this.ended.next(outcomeOf(reply));
      this.show(entryId, reply, request, Math.round(performance.now() - startedAt));
    } catch (error: unknown) {
      this.ended.next(FAILED);
      if (error instanceof AssistantRefused) this.showRefused(entryId);
      else this.showNoAnswer(entryId, request);
    } finally {
      this.asking.set(false);
    }
  }

  /** A new request cancels a jump and cuts off a reply being read. */
  private startWaiting(entryId: number): void {
    this.actions.cancelJump();
    this.cutSpeech = this.speech.stop() || this.carriedCut;
    this.carriedCut = false;
    this.log.setActions(entryId, []);
    this.log.setChip(entryId, WAITING_CHIP);
    this.log.say(entryId, saying(''));
  }

  private show(entryId: number, reply: RouteReply, request: RouteRequest, ms: number): void {
    this.log.setChip(entryId, chipOf(reply, ms));
    if (reply.tier === 1) this.showAction(entryId, reply);
    else if (reply.tier === 2 && reply.failed) this.showFailedAnswer(entryId, reply.failed);
    else if (reply.tier === 2) this.showAnswer(entryId, reply.text ?? '');
    // A task that comes with options is asking which project to run it in.
    else if (reply.tier === 3 && !reply.ask.length) this.showProposal(entryId, reply);
    else this.showOptions(entryId, reply, request);
  }

  /** Says what the action does as it starts ("Refreshing every project…"). */
  private showAction(entryId: number, reply: RouteReply): void {
    this.actions.carryOut(entryId, reply, this.cutSpeech);
    if (reply.op !== 'stop') this.speakSaid(entryId, 1);
  }

  private showFailedAnswer(entryId: number, failed: string): void {
    const asked = this.log.find(entryId)?.asked ?? '';
    this.log.say(entryId, noting(`Couldn’t get a quick answer: ${failed}.`));
    this.log.setActions(entryId, [
      { kind: 'send', label: 'Try again', request: { text: asked, pick: { tier: 2 } } },
    ]);
    this.speakSaid(entryId, 2);
  }

  private showAnswer(entryId: number, text: string): void {
    this.log.say(entryId, answering(text));
    this.speech.speak(text, entryId, 2);
  }

  /** A task is never read aloud: "shall I run this?" invites a spoken yes. */
  private showProposal(entryId: number, reply: RouteReply): void {
    this.log.say(entryId, noting('Proposed a task: see above.'));
    this.proposalCount++;
    this.proposals.show(commandProposalOf(reply, this.info.where(), this.proposalCount));
  }

  /** Unsure, or no model to ask: says so, and offers what it might have
   *  meant. Each option is the same request with the option's pick, so a
   *  skill stays that skill. */
  private showOptions(entryId: number, reply: RouteReply, request: RouteRequest): void {
    this.log.say(entryId, noting([reply.note, reply.question].filter(Boolean).join(' ')));
    const options: EntryAction[] = reply.ask.map((option) => ({
      kind: 'send',
      label: option.label,
      request: { ...request, pick: option.pick },
    }));
    this.log.setActions(entryId, options.length ? [...options, { kind: 'neither' }] : []);
  }

  private showNoAnswer(entryId: number, request: RouteRequest): void {
    this.log.setChip(entryId, NO_ANSWER_CHIP);
    this.log.say(entryId, noting('The site didn’t answer.'));
    this.log.setActions(entryId, [{ kind: 'send', label: 'Try again', request }]);
  }

  /** The hosted preview's visitor: no assistant here, which is not a failure. */
  private showRefused(entryId: number): void {
    this.info.noteRefused();
    this.log.setChip(entryId, NO_ANSWER_CHIP);
    this.log.say(entryId, noting('This is a preview; the assistant is the owner’s.'));
  }

  private leave(entryId: number): void {
    this.log.setActions(entryId, []);
    this.log.say(entryId, noting('Left it.'));
  }

  private speakSaid(entryId: number, tier: ReplyTier): void {
    const said = this.log.find(entryId)?.said.text ?? '';
    this.speech.speak(said, entryId, tier);
  }
}

/** Makes the feed the way a request reaches the assistant from outside the
 *  Ask box, such as the mic. */
export const ASK_FEED_CHANNEL: Provider = { provide: ASK_CHANNEL, useExisting: AskFeed };
