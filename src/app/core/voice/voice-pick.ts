import { Injectable, inject } from '@angular/core';
import { REPLY_VOICE } from './reply-voice';
import { SpeakPreference } from './speak-preference';
import { SpeakerOutput } from './speaker-output';
import { SPEECH_ENGINE } from './speech-engine';
import { VoiceChoice, VoiceEngineId } from './voice-choice';

/** The voice picker: a new engine cuts off the reply the old one was reading,
 *  lets the old one go, and gets the new one ready if Speak is on. */
@Injectable({ providedIn: 'root' })
export class VoicePick {
  private readonly choice = inject(VoiceChoice);
  private readonly engine = inject(SPEECH_ENGINE);
  private readonly replyVoice = inject(REPLY_VOICE);
  private readonly preference = inject(SpeakPreference);
  private readonly speaker = inject(SpeakerOutput);

  async chooseEngine(engine: VoiceEngineId): Promise<void> {
    if (engine === this.choice.engine()) return;
    this.replyVoice.stop();
    this.engine.release();
    this.choice.chooseEngine(engine);
    if (this.preference.isOn()) await this.warmUpChosen();
  }

  chooseVoice(voice: string): void {
    this.choice.chooseVoice(voice);
  }

  /** Inside the pick's own gesture, as a press of Speak is. A download
   *  question leaves Speak off until the viewer agrees. */
  private async warmUpChosen(): Promise<void> {
    this.speaker.wake();
    const onAgreed = (): void => this.preference.turnOn();
    const warmUp = await this.engine.warmUp({ takesFocus: true, mayAsk: true, onAgreed });
    if (warmUp === 'asked') this.preference.turnOffForVisit();
  }
}
