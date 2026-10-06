import { AudioTap } from './tab-audio';

/** Fine enough to split a kick from a bassline; 1024 bins at 48 kHz is ~23 Hz a bin. */
const FFT_SIZE = 2048;
/** Barely any smoothing: more blurs a kick's attack across frames and lands it late. */
const SMOOTHING = 0.2;

/** A live sound, and how to let go of it. */
export interface TappedSound {
  readonly context: AudioContext;
  readonly source: AudioNode;
  /** Registers a callback for the sound stopping from outside, once. */
  readonly onEnded: (callback: () => void) => void;
  /** Stops the sound and closes `context`. */
  readonly close: () => void;
}

/** `sound` read as a spectrum. It goes into an analyser only, never to the speakers. */
export function analyserTap(sound: TappedSound): AudioTap {
  const analyser = sound.context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = SMOOTHING;
  sound.source.connect(analyser);
  return {
    binHz: sound.context.sampleRate / FFT_SIZE,
    binCount: analyser.frequencyBinCount,
    read: (into) => analyser.getByteFrequencyData(into),
    onEnded: sound.onEnded,
    close: sound.close,
    sound: { context: sound.context, source: sound.source },
  };
}
