/** The name the PCM player registers under in the audio worklet. */
export const PCM_PLAYER = 'observatory-pcm-player';

/** How the player paces sound that arrives in uneven bursts. */
export interface PcmPlayerOptions {
  readonly channels: number;
  /** Frames to gather before playing, and after running dry: the jitter margin. */
  readonly startFrames: number;
  /** More than this waiting means it fell behind; it skips back to `startFrames`. */
  readonly maxFrames: number;
}

interface WorkletPort {
  onmessage: ((event: MessageEvent<Float32Array>) => void) | null;
}

interface WorkletProcessor {
  readonly port: WorkletPort;
}

/** The audio worklet's own globals, which the DOM typings leave out. */
declare const AudioWorkletProcessor: new () => WorkletProcessor;
declare function registerProcessor(
  name: string,
  processor: new (options: { readonly processorOptions: PcmPlayerOptions }) => WorkletProcessor,
): void;

/**
 * Registers the PCM player: it plays interleaved float frames posted to its
 * port, a quantum at a time, and plays silence while it waits for more.
 *
 * Runs inside the audio worklet's own scope, sent there as this function's
 * source text, so nothing outside the function exists there: it must stay
 * self-contained, its name string included.
 */
export function definePcmPlayer(): void {
  class PcmPlayer extends AudioWorkletProcessor {
    private readonly options: PcmPlayerOptions;
    private readonly chunks: Float32Array[] = [];
    /** Frames already played from the first chunk. */
    private offset = 0;
    private buffered = 0;
    private isPlaying = false;

    constructor({ processorOptions }: { readonly processorOptions: PcmPlayerOptions }) {
      super();
      this.options = processorOptions;
      this.port.onmessage = (event) => this.add(event.data);
    }

    process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
      const output = outputs[0] ?? [];
      const frames = output[0]?.length ?? 0;
      if (!this.isPlaying && this.buffered >= this.options.startFrames) this.isPlaying = true;
      if (this.isPlaying && this.buffered < frames) this.isPlaying = false;
      if (this.isPlaying) this.play(output, frames);
      return true;
    }

    private add(samples: Float32Array): void {
      this.chunks.push(samples);
      this.buffered += samples.length / this.options.channels;
      if (this.buffered > this.options.maxFrames)
        this.skip(this.buffered - this.options.startFrames);
    }

    private play(output: Float32Array[], frames: number): void {
      const channels = this.options.channels;
      for (let frame = 0; frame < frames; frame++) {
        const chunk = this.chunks[0] ?? new Float32Array(channels);
        for (let channel = 0; channel < output.length; channel++) {
          const target = output[channel];
          if (target) target[frame] = chunk[this.offset * channels + (channel % channels)] ?? 0;
        }
        this.skip(1);
      }
    }

    private skip(frames: number): void {
      let left = frames;
      while (left > 0 && this.chunks.length) {
        const chunkFrames = (this.chunks[0]?.length ?? 0) / this.options.channels;
        const step = Math.min(left, chunkFrames - this.offset);
        this.offset += step;
        this.buffered -= step;
        left -= step;
        if (this.offset >= chunkFrames) {
          this.chunks.shift();
          this.offset = 0;
        }
      }
    }
  }
  registerProcessor('observatory-pcm-player', PcmPlayer);
}

/** The player as a module the audio worklet can load; revoke it once loaded. */
export function pcmPlayerModuleUrl(): string {
  const source = `(${definePcmPlayer.toString()})();`;
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}
