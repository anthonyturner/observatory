import { SpeakPreference } from './speak-preference';
import { SpeakerOutput } from './speaker-output';
import { SpeechEngine } from './speech-engine';

export interface SpeakOnParts {
  readonly engine: SpeechEngine;
  readonly preference: SpeakPreference;
  readonly speaker: SpeakerOutput;
}

/** Turns Speak on from a press: wakes the output inside the gesture, then
 *  asks before a first download or turns on at once. */
export async function switchSpeakOn({ engine, preference, speaker }: SpeakOnParts): Promise<void> {
  speaker.wake();
  const turnOn = (): void => preference.turnOn();
  const warmUp = await engine.warmUp({ takesFocus: true, mayAsk: true, onAgreed: turnOn });
  if (warmUp === 'ready') turnOn();
}
