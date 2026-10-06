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

/** A live sound, and how to let go of it. */
export interface TappedSound extends LiveSound {
  /** Registers a callback for the sound stopping from outside, once. */
  readonly onEnded: (callback: () => void) => void;
  /** Stops the sound and closes its context. */
  readonly close: () => void;
}

/** `sound` read as a spectrum. It goes into an analyser only, never to the
 *  speakers: the sound is already playing. */
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

/** Reads `audio`, a track of `stream`, as a spectrum; closing the tap stops the stream. */
export function tapOf(stream: MediaStream, audio: MediaStreamTrack): AudioTap {
  const context = new AudioContext();
  // Made once the browser's prompt is answered, outside the click, so a phone's
  // browser may start it suspended, and a suspended analyser reads silence.
  if (context.state === 'suspended') context.resume().catch(() => undefined);
  return analyserTap({
    context,
    source: context.createMediaStreamSource(stream),
    onEnded: (callback) => audio.addEventListener('ended', callback, { once: true }),
    close: () => {
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  });
}
