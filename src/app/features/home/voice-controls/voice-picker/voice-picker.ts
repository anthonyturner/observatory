import { ChangeDetectionStrategy, Component, ErrorHandler, computed, inject } from '@angular/core';
import { ActiveVoice } from '../../../../core/voice/active-voice';
import { VoiceCatalog } from '../../../../core/voice/voice-catalog';
import { CatalogVoice } from '../../../../core/voice/voice-catalog.types';
import { VoiceEngineId } from '../../../../core/voice/voice-choice';
import { VoicePick } from '../../../../core/voice/voice-pick';

const NO_VOICES: readonly CatalogVoice[] = [];
const ELEVENLABS_TITLE = 'Replies are read by ElevenLabs, through this site';

/** Which voice reads replies: Kokoro in this browser, or ElevenLabs in one
 *  of the account's voices. ElevenLabs is shown but not offered when it
 *  cannot speak here, with the reason. */
@Component({
  selector: 'app-voice-picker',
  templateUrl: './voice-picker.html',
  styleUrl: './voice-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoicePicker {
  private readonly active = inject(ActiveVoice);
  private readonly catalog = inject(VoiceCatalog);
  private readonly pick = inject(VoicePick);
  private readonly errors = inject(ErrorHandler);

  protected readonly blocker = this.active.blocker;
  protected readonly isElevenLabs = computed(() => this.active.speaker().engine === 'elevenlabs');
  protected readonly elevenLabsTitle = computed(() => this.blocker() ?? ELEVENLABS_TITLE);
  protected readonly voiceId = computed(() => this.active.elevenLabsVoice()?.id ?? null);
  protected readonly voices = computed(() => {
    const catalog = this.catalog.state();
    return this.isElevenLabs() && catalog.status === 'on' ? catalog.voices : NO_VOICES;
  });

  protected onEngine(engine: VoiceEngineId): void {
    this.pick.chooseEngine(engine).catch((error: unknown) => this.errors.handleError(error));
  }

  protected onVoice(event: Event): void {
    const select = event.target;
    if (select instanceof HTMLSelectElement) this.pick.chooseVoice(select.value);
  }
}
