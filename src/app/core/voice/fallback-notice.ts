import { Injectable, effect, inject, untracked } from '@angular/core';
import { ActiveVoice } from './active-voice';
import { SpeakPreference } from './speak-preference';
import { VoiceNarration } from './voice-narration';
import { VoiceStatus } from './voice-status';

const kokoroSpeaks = (reason: string): string => `${reason}, so Kokoro speaks.`;

/** Says once a visit, in the voice status line, why Kokoro reads replies
 *  though the viewer chose ElevenLabs: as soon as both are true, so it is
 *  said before Kokoro asks about a download rather than lost behind it. */
@Injectable({ providedIn: 'root' })
export class FallbackNotice {
  private readonly active = inject(ActiveVoice);
  private readonly preference = inject(SpeakPreference);
  private readonly status = inject(VoiceStatus);
  private readonly narration = inject(VoiceNarration);
  private hasSaid = false;

  constructor() {
    effect(() => {
      const reason = this.active.fallbackReason();
      if (reason !== null && this.preference.isOn()) untracked(() => this.say(reason));
    });
  }

  private say(reason: string): void {
    if (this.hasSaid) return;
    this.hasSaid = true;
    const words = kokoroSpeaks(reason);
    this.status.show(words);
    this.narration.echo(words);
  }
}
