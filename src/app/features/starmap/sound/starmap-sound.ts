import {
  DOCUMENT,
  DestroyRef,
  ErrorHandler,
  Injectable,
  InjectionToken,
  inject,
  signal,
} from '@angular/core';
import { StarmapScore, WebAudioStarmapScore } from './starmap-score';

/** Makes the score; a test provides one that needs no audio device. */
export const STARMAP_SCORE = new InjectionToken<() => StarmapScore>('STARMAP_SCORE', {
  providedIn: 'root',
  factory: () => () => new WebAudioStarmapScore(),
});

const SOUND_KEY = 'observatory.starmap.sound';
const VOLUME_KEY = 'observatory.starmap.volume';
const DEFAULT_VOLUME = 0.7;
const GESTURES = ['pointerdown', 'keydown'] as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // This visit only.
  }
}

/**
 * The star map's sound, as pr-starmap's: off until asked for, remembered with
 * its volume, back on the first touch of a later visit (browsers allow no
 * sooner), and picked up again when the tab returns.
 */
@Injectable({ providedIn: 'root' })
export class StarmapSound {
  private readonly makeScore = inject(STARMAP_SCORE);
  private readonly errors = inject(ErrorHandler);
  private readonly document = inject(DOCUMENT);
  private score: StarmapScore | null = null;
  private tension = 0;

  readonly isOn = signal(read(SOUND_KEY) === 'on');
  readonly volume = signal(parseVolume(read(VOLUME_KEY)));

  constructor() {
    const window = this.document.defaultView;
    const resume = (): void => {
      unlisten();
      if (this.isOn()) this.play();
    };
    const unlisten = (): void =>
      GESTURES.forEach((gesture) => window?.removeEventListener(gesture, resume));
    if (this.isOn()) GESTURES.forEach((gesture) => window?.addEventListener(gesture, resume));
    const returning = (): void => {
      if (!this.document.hidden && this.isOn()) this.play();
    };
    this.document.addEventListener('visibilitychange', returning);
    inject(DestroyRef).onDestroy(() => {
      unlisten();
      this.document.removeEventListener('visibilitychange', returning);
    });
  }

  toggle(): void {
    this.isOn.update((on) => !on);
    write(SOUND_KEY, this.isOn() ? 'on' : 'off');
    if (this.isOn()) this.play();
    else this.score?.stop();
  }

  setVolume(volume: number): void {
    this.volume.set(volume);
    write(VOLUME_KEY, String(volume));
    this.score?.setVolume(volume);
  }

  /** How many things are blocked: the tension voice follows it. */
  setTension(blocked: number): void {
    this.tension = blocked;
    this.score?.setTension(blocked);
  }

  /** A soft tone when a star is chosen: lower when it is stuck. */
  ping(stuck: boolean, pr = 0): void {
    if (this.isOn()) this.score?.ping(stuck, pr);
  }

  /** A short crackle when a meteor lands, only while sound is on. */
  crackle(pan: number, strength: number, seed: number): void {
    if (this.isOn()) this.score?.crackle(pan, strength, seed);
  }

  private play(): void {
    this.score ??= this.makeScore();
    this.score.setVolume(this.volume());
    this.score.setTension(this.tension);
    this.score.start().catch((error: unknown) => this.errors.handleError(error));
  }
}

function parseVolume(stored: string | null): number {
  const v = stored === null ? NaN : parseFloat(stored);
  return v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
}
