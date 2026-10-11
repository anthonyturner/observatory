import { sentences } from '../sentences';
import { SpeechEngine, WarmUp, WarmUpRequest } from '../speech-engine';
import { SpokenClip, VoiceRole } from '../voice-protocol';

/** An engine that answers as told, keeping what it was asked. */
export class FakeSpeechEngine implements SpeechEngine {
  warmUpAnswer: WarmUp = 'ready';
  failure: Error | null = null;
  warmUps = 0;
  released = 0;
  readonly said: string[] = [];
  /** The role each piece in `said` was asked in, in step with it. */
  readonly roles: VoiceRole[] = [];
  readonly warmUpRequests: WarmUpRequest[] = [];
  readonly clip: SpokenClip = { audio: new Float32Array(1), rate: 1 };

  async warmUp(request: WarmUpRequest): Promise<WarmUp> {
    this.warmUps++;
    this.warmUpRequests.push(request);
    return this.warmUpAnswer;
  }

  parts(text: string): string[] {
    return sentences(text);
  }

  async synthesize(sentence: string, role: VoiceRole): Promise<SpokenClip> {
    if (this.failure) throw this.failure;
    this.said.push(sentence);
    this.roles.push(role);
    return this.clip;
  }

  release(): void {
    this.released++;
  }
}
