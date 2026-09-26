import { SpeechEngine, WarmUp } from '../speech-engine';
import { SpokenClip } from '../voice-protocol';

/** An engine that answers as told, keeping what it was asked. */
export class FakeSpeechEngine implements SpeechEngine {
  warmUpAnswer: WarmUp = 'ready';
  failure: Error | null = null;
  warmUps = 0;
  released = 0;
  readonly said: string[] = [];
  readonly clip: SpokenClip = { audio: new Float32Array(1), rate: 1 };

  async warmUp(): Promise<WarmUp> {
    this.warmUps++;
    return this.warmUpAnswer;
  }

  async synthesize(sentence: string): Promise<SpokenClip> {
    if (this.failure) throw this.failure;
    this.said.push(sentence);
    return this.clip;
  }

  release(): void {
    this.released++;
  }
}
