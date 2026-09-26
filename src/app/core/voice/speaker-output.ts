import { DOCUMENT, DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { SPEECH_LEVEL, nextLevel } from './level-math';
import { VoiceError } from './voice-error';
import { LIMIT_MS, within } from './within';

export const AUDIO_CONTEXT = new InjectionToken<() => AudioContext>('AudioContext', {
  providedIn: 'root',
  factory: () => () => new AudioContext(),
});

const LEVEL_FFT_SIZE = 512;

/** Where a reply's sound goes in: through the level analyser to the speakers. */
export interface SpeakerLine {
  readonly context: AudioContext;
  readonly input: AudioNode;
}

interface Output {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  readonly samples: Float32Array<ArrayBuffer>;
}

/** One output for every reply, and how loud it is. */
@Injectable({ providedIn: 'root' })
export class SpeakerOutput {
  private readonly makeContext = inject(AUDIO_CONTEXT);
  private output: Output | null = null;
  private smoothed = 0;

  constructor() {
    const window = inject(DOCUMENT).defaultView;
    // Into the back-forward cache, the output stays; only a page that is
    // really gone closes it.
    const leave = (event: PageTransitionEvent): void => {
      if (!event.persisted) this.close();
    };
    window?.addEventListener('pagehide', leave);
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('pagehide', leave);
      this.close();
    });
  }

  /** Made or woken inside a press or a key, because Safari and iOS start
   *  sound only from inside the gesture itself, not after an await. */
  wake(): void {
    const context = this.open()?.context;
    if (context && context.state !== 'running') context.resume().catch(() => undefined);
  }

  /** The output, playing. Rejects with `audio` when there is none, or the
   *  browser has not let the page play sound. */
  async ready(): Promise<SpeakerLine> {
    const output = this.open();
    if (!output) throw new VoiceError('No Web Audio in this browser', 'audio');
    const { context, analyser } = output;
    if (context.state !== 'running') {
      await within(context.resume(), LIMIT_MS.audio, 'audio').catch(() => undefined);
    }
    if (!isRunning(context)) {
      throw new VoiceError('The browser has not let the page play sound.', 'audio');
    }
    return { context, input: analyser };
  }

  /** How loud the reply is now, 0 to 1, smoothed; read once a frame. */
  level(): number {
    if (!this.output) return 0;
    const { analyser, samples } = this.output;
    analyser.getFloatTimeDomainData(samples);
    this.smoothed = nextLevel(this.smoothed, samples, SPEECH_LEVEL);
    return this.smoothed;
  }

  /** No Web Audio here: a reply then says it was not spoken. */
  private open(): Output | null {
    if (this.output) return this.output;
    try {
      const context = this.makeContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = LEVEL_FFT_SIZE;
      analyser.connect(context.destination);
      this.output = { context, analyser, samples: new Float32Array(analyser.fftSize) };
    } catch {
      this.output = null;
    }
    return this.output;
  }

  private close(): void {
    this.output?.context.close().catch(() => undefined);
    this.output = null;
  }
}

/** Read afresh: `resume` changes the state after the check above it. */
function isRunning(context: AudioContext): boolean {
  return context.state === 'running';
}
