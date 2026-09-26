import { VoiceError, VoiceFailureKind } from './voice-error';

/** How long each step may take before Home gives up on it. A clip of 30
 *  seconds took about 12 s on a busy processor in pr-starmap's spike. */
export const LIMIT_MS = {
  /** The recorder handing over what it caught. */
  stop: 3000,
  /** A model loading, download included. */
  model: 60000,
  /** One transcription or one spoken sentence. */
  run: 90000,
  /** The browser letting the page play sound. */
  audio: 1000,
} as const;

/** Settles as `promise` does, or fails with `kind` after `ms`. */
export function within<T>(promise: Promise<T>, ms: number, kind: VoiceFailureKind): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new VoiceError(`${kind}: no answer in ${ms} ms`, kind)),
      ms,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
