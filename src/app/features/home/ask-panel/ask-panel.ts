import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { AskBoxFocus } from '../../../core/assistant/ask-box-focus';
import { AskDraft } from '../../../core/assistant/ask-draft';
import { AskFeed, ELSEWHERE } from '../../../core/assistant/ask-feed';
import { AssistantInfo } from '../../../core/assistant/assistant-info';
import { Conversation } from '../../../core/assistant/conversation';
import { jevOffNote } from '../../../core/assistant/jev-off-note';
import { OpenQuestion } from '../../../core/assistant/open-question';
import { ProposalSlot } from '../../../core/assistant/proposal';
import { ReplyFocus } from '../../../core/assistant/reply-focus';
import { ReplyLog } from '../../../core/assistant/reply-log';
import { ReplySpeech } from '../../../core/assistant/reply-speech';
import { PROJECTS } from '../../../core/projects/projects-source';
import { compareProjects } from '../../../core/projects/severity';
import { codeSpans } from '../../../core/text/inline-code';
import { HudSection } from '../../../shared/hud-section/hud-section';
import { AskBar } from '../ask-bar/ask-bar';
import { AskKeys } from './ask-keys';
import { ProposalCard } from '../proposal-card/proposal-card';
import { QuestionCard } from '../question-card/question-card';
import { ReplyList } from '../reply-list/reply-list';
import { RunCard } from '../run-card/run-card';
import { VoiceControls } from '../voice-controls/voice-controls';

/** Replies on show; the rest fold into Earlier. */
export const REPLIES_SHOWN = 5;

const WORKING = 'Working out how to handle it';

/** The assistant: where a question is typed or spoken, and its replies. A
 *  visitor to the hosted preview sees one line instead, since every request
 *  would be paid for by the owner, and the API refuses them anyway. */
@Component({
  selector: 'app-ask-panel',
  imports: [
    HudSection,
    VoiceControls,
    AskBar,
    AskKeys,
    ReplyList,
    ProposalCard,
    RunCard,
    QuestionCard,
  ],
  templateUrl: './ask-panel.html',
  styleUrl: './ask-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskPanel {
  protected readonly feed = inject(AskFeed);
  protected readonly focus = inject(AskBoxFocus);
  protected readonly speech = inject(ReplySpeech);
  protected readonly replyFocus = inject(ReplyFocus);
  private readonly info = inject(AssistantInfo);
  private readonly log = inject(ReplyLog);
  private readonly projects = inject(PROJECTS);
  protected readonly slot = inject(ProposalSlot);
  protected readonly draft = inject(AskDraft);
  protected readonly conversation = inject(Conversation);
  protected readonly question = inject(OpenQuestion);
  private readonly bar = viewChild(AskBar);

  protected readonly isElsewhere = this.info.isElsewhere;
  protected readonly elsewhere = ELSEWHERE;
  protected readonly isKeywordsOnly = computed(() => this.info.jev() === 'off');
  protected readonly status = computed(() => (this.feed.busy() ? WORKING : ''));
  protected readonly shown = computed(() => this.log.entries().slice(0, REPLIES_SHOWN));
  protected readonly earlier = computed(() => this.log.entries().slice(REPLIES_SHOWN));
  /** As a list, so a new proposal draws a new card and takes the focus. */
  protected readonly proposals = computed(() => {
    const proposal = this.slot.proposal();
    return proposal ? [proposal] : [];
  });
  /** The example names the first project in card order. */
  protected readonly jevOff = computed(() => {
    if (!this.isKeywordsOnly()) return null;
    const first = [...this.projects()].sort(compareProjects)[0]?.name ?? null;
    return codeSpans(jevOffNote(this.info.where(), first));
  });

  constructor() {
    this.question.panelArrived();
    inject(DestroyRef).onDestroy(() => this.question.panelLeft());
  }

  /** Esc cancels a jump, else cuts off speech, else leaves the box. */
  protected onEscape(): void {
    if (this.feed.hasPendingJump()) this.feed.stayHere();
    else if (!this.speech.stop()) this.bar()?.blur();
  }
}
