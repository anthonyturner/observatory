import { Injectable, Provider, computed, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ASK_CHANNEL, AskChannel } from './ask-channel';
import { AskBoxFocus } from './ask-box-focus';
import { AskDraft } from './ask-draft';
import { AskOutcome, FAILED, outcomeOf } from './ask-outcome';
import { ASSISTANT_API, AssistantAbsent } from './assistant-api';
import { AssistantInfo } from './assistant-info';
import { Conversation } from './conversation';
import { RoutePick, RouteReply, RouteRequest, Skill, Source } from './assistant.types';
import { OpenQuestion } from './open-question';
import { PageJump } from './page-jump';
import { Proposal, ProposalSlot, RunProposal, commandProposalOf, runProposalOf } from './proposal';
import { NO_ANSWER_CHIP, WAITING_CHIP, chipOf } from './reply-chip';
import { AskedHow, EntryAction, answering, noting, saying } from './reply-entry';
import { ReplyLog } from './reply-log';
import { ReplySpeech } from './reply-speech';
import { TierOneActions } from './tier-one-actions';
import { Clock } from '../time/clock';

const PROPOSED = 'Proposed a task: see above.';
const ACTION_TIER = 1;

/** The same request with a pressed option's pick. A pick is settled, so it
 *  goes without the conversation. */
const withPick = (request: RouteRequest, pick: RoutePick): RouteRequest =>
  request.skill ? { skill: request.skill, pick } : { text: request.text, pick };

/** Why there is no assistant on this site. */
export const ELSEWHERE = 'Jev runs only on the owner’s own computer, not on this site.';

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
  private readonly question = inject(OpenQuestion);
  private readonly focus = inject(AskBoxFocus);
  private readonly draft = inject(AskDraft);
  private readonly clock = inject(Clock);
  private readonly conversation = inject(Conversation);
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
    const spoken = options?.spoken ?? false;
    if (asked && spoken && this.holdsSpeech()) return this.hold(asked);
    if (!asked || this.asking()) return;
    this.carriedCut = spoken && this.cutSpeech;
    void this.converse(asked, this.open(asked, spoken ? 'spoken' : 'typed'));
  }

  /** Starts a new conversation: Jev forgets what was said so far. The replies stay on show. */
  newConversation(): void {
    this.conversation.clear();
    this.focus.request();
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

  /** Open on the question's card goes at once: a click is no guess, so it
   *  has no grace second. */
  openAsked(href: string): void {
    this.question.close();
    this.jump.go(href);
  }

  dismissQuestion(): void {
    this.question.close();
    this.focus.request();
  }

  dismissProposal(): void {
    this.proposals.dismiss();
    this.focus.request();
  }

  /** Cancel on a proposal to run: its reply says it was left. */
  leaveProposal(entryId: number): void {
    this.log.say(entryId, noting('Left it.'));
    this.dismissProposal();
  }

  /** Asks for the same task again, in the same project, as a fresh proposal. */
  proposeAgain(proposal: RunProposal): void {
    this.proposals.dismiss();
    const request = { text: proposal.prompt, pick: { tier: 3, project: proposal.project } };
    void this.send(request, proposal.entryId);
  }

  /** Words heard while something else is on the go (a request on its way,
   *  words in the box, a task proposed) are put in the box, not sent: sending
   *  could be the wrong thing, and speech never starts a task. */
  private holdsSpeech(): boolean {
    return this.asking() || !this.draft.isEmpty() || this.proposals.proposal() !== null;
  }

  private hold(heard: string): void {
    this.draft.add(heard);
    this.proposals.hear(heard);
  }

  private open(asked: string, how: AskedHow): number {
    return this.log.open(asked, how);
  }

  /** Typed or spoken words go with the conversation so far, and join it once answered. */
  private async converse(asked: string, entryId: number): Promise<void> {
    const reply = await this.send({ text: asked, history: this.conversation.history() }, entryId);
    if (reply) this.conversation.record(asked, reply);
  }

  /** Sends `request` into the reply `entryId`, and settles with the reply
   *  once it is shown, or null when there was none. */
  private async send(request: RouteRequest, entryId: number): Promise<RouteReply | null> {
    if (this.asking()) return null;
    this.asking.set(true);
    this.startWaiting(entryId);
    const startedAt = performance.now();
    try {
      const reply = await this.api.route(request);
      if (reply.jev) this.info.noteJev(reply.jev);
      this.ended.next(outcomeOf(reply));
      this.show(entryId, reply, request, Math.round(performance.now() - startedAt));
      return reply;
    } catch (error: unknown) {
      this.ended.next(FAILED);
      if (error instanceof AssistantAbsent) this.showAbsent(entryId);
      else this.showNoAnswer(entryId, request);
      return null;
    } finally {
      this.asking.set(false);
    }
  }

  /** A new request cancels a jump, closes the open question and cuts off a reply being read. */
  private startWaiting(entryId: number): void {
    this.actions.cancelJump();
    this.question.close();
    this.cutSpeech = this.speech.stop() || this.carriedCut;
    this.carriedCut = false;
    this.log.setActions(entryId, []);
    this.log.setChip(entryId, WAITING_CHIP);
    this.log.say(entryId, saying(''));
  }

  private show(entryId: number, reply: RouteReply, request: RouteRequest, ms: number): void {
    this.log.setChip(entryId, chipOf(reply, ms));
    if (reply.tier === 1) this.showAction(entryId, reply);
    else if (reply.tier === 2) this.showAnswer(entryId, reply.text ?? '', reply.sources ?? []);
    // A task that comes with options is asking which project to run it in.
    else if (reply.tier === 3 && !reply.ask.length) this.showProposal(entryId, reply);
    else this.showOptions(entryId, reply, request);
  }

  /** Says what the action does as it starts ("Refreshing every project…"). */
  private showAction(entryId: number, reply: RouteReply): void {
    this.actions.carryOut(entryId, reply, this.cutSpeech);
    if (reply.op !== 'stop') this.speakAction(entryId);
  }

  /** Only the words are read aloud; a web answer's sources are listed, not spoken. */
  private showAnswer(entryId: number, text: string, sources: readonly Source[]): void {
    this.log.say(entryId, answering(text, sources));
    this.speech.speak(text, entryId, 2);
  }

  /** A task is never read aloud, Jev's words about it included: "shall I
   *  run this?" invites a spoken yes. */
  private showProposal(entryId: number, reply: RouteReply): void {
    this.log.say(entryId, reply.text ? answering(reply.text) : noting(PROPOSED));
    this.proposalCount++;
    this.proposals.show(this.proposalOf(entryId, reply));
  }

  /** With the runner's ticket, which only the local site gives, a proposal
   *  that can run here; otherwise the command to copy. */
  private proposalOf(entryId: number, reply: RouteReply): Proposal {
    const { run: ticket, prompt } = reply;
    if (!ticket || !prompt) return commandProposalOf(reply, this.info.where(), this.proposalCount);
    return runProposalOf(
      { reply, ticket, prompt, entryId },
      this.proposalCount,
      this.clock.now().getTime(),
    );
  }

  /** No model to ask, or a project to choose: says so, and offers what it
   *  might have meant. Each option is the same request with the option's pick, so a
   *  skill stays that skill. */
  private showOptions(entryId: number, reply: RouteReply, request: RouteRequest): void {
    this.log.say(entryId, noting([reply.note, reply.question].filter(Boolean).join(' ')));
    const options: EntryAction[] = reply.ask.map((option) => ({
      kind: 'send',
      label: option.label,
      request: withPick(request, option.pick),
    }));
    this.log.setActions(entryId, options.length ? [...options, { kind: 'neither' }] : []);
  }

  private showNoAnswer(entryId: number, request: RouteRequest): void {
    this.log.setChip(entryId, NO_ANSWER_CHIP);
    this.log.say(entryId, noting('The site didn’t answer.'));
    this.log.setActions(entryId, [{ kind: 'send', label: 'Try again', request }]);
  }

  /** No assistant on this site, which is not a failure. */
  private showAbsent(entryId: number): void {
    this.info.noteAbsent();
    this.log.setChip(entryId, NO_ANSWER_CHIP);
    this.log.say(entryId, noting(ELSEWHERE));
  }

  private leave(entryId: number): void {
    this.log.setActions(entryId, []);
    this.log.say(entryId, noting('Left it.'));
  }

  /** Reads out what an action says as it starts. */
  private speakAction(entryId: number): void {
    const said = this.log.find(entryId)?.said.text ?? '';
    this.speech.speak(said, entryId, ACTION_TIER);
  }
}

/** Makes the feed the way a request reaches the assistant from outside the
 *  Ask box, such as the mic. */
export const ASK_FEED_CHANNEL: Provider = { provide: ASK_CHANNEL, useExisting: AskFeed };
