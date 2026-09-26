import { Injectable, inject } from '@angular/core';
import { REPLY_VOICE } from './reply-voice';
import { switchSpeakOn } from './speak-on';
import { SpeakPreference } from './speak-preference';
import { SpeakerOutput } from './speaker-output';
import { SPEECH_ENGINE } from './speech-engine';

/** The Speak button: on for the first time, it asks before the download;
 *  after that the model loads from the browser's cache. */
@Injectable({ providedIn: 'root' })
export class SpeakSwitch {
  private readonly preference = inject(SpeakPreference);
  private readonly engine = inject(SPEECH_ENGINE);
  private readonly speaker = inject(SpeakerOutput);
  private readonly replyVoice = inject(REPLY_VOICE);

  async press(): Promise<void> {
    if (this.preference.isOn()) {
      this.turnOff();
      return;
    }
    const { engine, preference, speaker } = this;
    await switchSpeakOn({ engine, preference, speaker });
  }

  /** Wakes the output inside a gesture, so a reply can play after it. */
  wake(): void {
    if (this.preference.isOn()) this.speaker.wake();
  }

  private turnOff(): void {
    this.preference.turnOff();
    this.replyVoice.stop();
    this.engine.release();
  }
}
