/** The heard sound as a live audio node, for a visualizer that listens for itself. */
export interface LiveSound {
  readonly context: AudioContext;
  readonly source: AudioNode;
}

/** A sound the page hears, ready to read as a spectrum. */
export interface AudioTap {
  /** Hertz per bin of `read`. */
  readonly binHz: number;
  readonly binCount: number;
  /** Fills `into` with the spectrum now, one byte per bin. */
  read(into: Uint8Array<ArrayBuffer>): void;
  /** Called once if sharing stops from outside, as from Chrome's "Stop sharing". */
  onEnded(callback: () => void): void;
  close(): void;
  /** The sound itself, where the tap is a real one. */
  readonly sound?: LiveSound;
}

/** Sharing went ahead without its sound: the audio box was left unticked. */
export class NoAudioError extends Error {
  constructor() {
    super('The share came without its sound');
  }
}

/** This browser cannot capture the chosen sound. */
export class CaptureUnsupportedError extends Error {
  constructor() {
    super('This browser cannot capture this sound');
  }
}

/** Fine enough to split a kick from a bassline; 1024 bins at 48 kHz is ~23 Hz a bin. */
const FFT_SIZE = 2048;
/** Barely any smoothing: more blurs a kick's attack across frames and lands it late. */
const SMOOTHING = 0.2;

/** Reads `audio`, a track of `stream`, as a spectrum; closing the tap stops the stream. */
export function tapOf(stream: MediaStream, audio: MediaStreamTrack): AudioTap {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = SMOOTHING;
  // Into the analyser only, never to the speakers: the sound is already playing.
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);
  const close = (): void => {
    stream.getTracks().forEach((track) => track.stop());
    void context.close();
  };
  return {
    binHz: context.sampleRate / FFT_SIZE,
    binCount: analyser.frequencyBinCount,
    read: (into) => analyser.getByteFrequencyData(into),
    onEnded: (callback) => audio.addEventListener('ended', callback, { once: true }),
    close,
    sound: { context, source },
  };
}
