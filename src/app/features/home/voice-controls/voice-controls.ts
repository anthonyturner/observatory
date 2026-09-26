import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';
import { ActiveVoice } from '../../../core/voice/active-voice';
import { ModelLoaders } from '../../../core/voice/model-loaders';
import { PushToTalk } from '../../../core/voice/push-to-talk';
import { REPLY_VOICE } from '../../../core/voice/reply-voice';
import { SpeakPreference } from '../../../core/voice/speak-preference';
import { SpeakSwitch } from '../../../core/voice/speak-switch';
import { VoiceLevel } from '../../../core/voice/voice-level';
import { VoiceNarration } from '../../../core/voice/voice-narration';
import { StatusAction, VoiceControlId, VoiceStatus } from '../../../core/voice/voice-status';
import { captionFor } from './voice-caption';
import { levelWeights } from './voice-level';
import { VoiceKeys } from './voice-keys';
import { VoicePicker } from './voice-picker/voice-picker';
import { VoiceStatusLine } from './voice-status-line/voice-status-line';

const PRIMARY_BUTTON = 0;

/** The voice block: its state dots, the level line, Tap to talk, Speak, the
 *  reply voice, and what voice is doing. The dots repeat the talk button's state. */
@Component({
  selector: 'app-voice-controls',
  imports: [HudSection, VoicePicker, VoiceStatusLine],
  hostDirectives: [VoiceKeys],
  templateUrl: './voice-controls.html',
  styleUrl: './voice-controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.recording]': 'talk.isRecording()',
    '[class.working]': 'talk.isWorking()',
    '[class.blocked]': 'talk.isBlocked()',
    '[class.loading]': 'isLoading()',
  },
})
export class VoiceControls {
  protected readonly talk = inject(PushToTalk);
  private readonly speakSwitch = inject(SpeakSwitch);
  private readonly errors = inject(ErrorHandler);
  private readonly loaders = inject(ModelLoaders);
  private readonly micButton = viewChild.required<ElementRef<HTMLButtonElement>>('mic');
  private readonly speakButton = viewChild.required<ElementRef<HTMLButtonElement>>('speak');

  protected readonly dashWeights = levelWeights();
  protected readonly level = inject(VoiceLevel).level;
  protected readonly statusLine = inject(VoiceStatus).line;
  protected readonly restingLine = this.loaders.restingLine;
  protected readonly said = inject(VoiceNarration).said;
  protected readonly isSpeakOn = inject(SpeakPreference).isOn;
  private readonly speaker = inject(ActiveVoice).speaker;
  protected readonly caption = computed(() => captionFor(this.speaker()));
  protected readonly micProgress = this.loaders.progressOf('mic');
  protected readonly speakProgress = this.loaders.progressOf('speak');
  protected readonly isLoading = computed(
    () => this.micProgress() !== null || this.speakProgress() !== null,
  );
  protected readonly micWord = computed(() => {
    if (this.talk.isRecording()) return 'Listening';
    return this.talk.isWorking() ? 'Transcribing' : 'Tap to talk';
  });

  constructor() {
    const replyVoice = inject(REPLY_VOICE);
    inject(DestroyRef).onDestroy(() => {
      this.talk.discard();
      replyVoice.stop();
    });
  }

  protected onMicDown(event: PointerEvent): void {
    if (event.button !== PRIMARY_BUTTON) return;
    // Captured, so letting go anywhere still counts as letting go here.
    this.micButton().nativeElement.setPointerCapture?.(event.pointerId);
    this.report(this.talk.press('hold'));
  }

  /** A click with no pointer behind it is the keyboard: Space or Enter on
   *  the mic toggles, since a key on a button cannot be held the way M can. */
  protected onMicClick(event: MouseEvent): void {
    if (event.detail === 0) this.report(this.talk.press('toggle'));
  }

  protected onSpeak(): void {
    this.report(this.speakSwitch.press());
  }

  protected onAction(action: StatusAction): void {
    action.run();
    this.buttonFor(action.focusAfter).focus();
  }

  private buttonFor(control: VoiceControlId): HTMLButtonElement {
    return (control === 'mic' ? this.micButton() : this.speakButton()).nativeElement;
  }

  private report(pressed: Promise<void>): void {
    pressed.catch((error: unknown) => this.errors.handleError(error));
  }
}
