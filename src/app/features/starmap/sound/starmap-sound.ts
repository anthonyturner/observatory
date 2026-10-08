import {
  DOCUMENT,
  DestroyRef,
  ErrorHandler,
  Injectable,
  InjectionToken,
  inject,
  signal,
} from '@angular/core';
import { SatelliteState } from '../../../core/live-agents/satellites';

import { MergeCue } from '../memory/merge-supernova';
import { StarmapScore, WebAudioStarmapScore } from './starmap-score';

/** Makes the score; a test provides one that needs no audio device. */
export const STARMAP_SCORE = new InjectionToken<() => StarmapScore>('STARMAP_SCORE', {
  providedIn: 'root',
  factory: () => () => new WebAudioStarmapScore(),
});

const SOUND_KEY = 'observatory.starmap.sound';
const VOLUME_KEY = 'observatory.starmap.volume';
const DEFAULT_VOLUME = 0.7;
/** A working satellite beeps highest and a quiet one lowest. */
const BEEP_HZ: Readonly<Record<SatelliteState, number>> = {
  working: 1568,
  waiting: 1319,
  quiet: 988,
};
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

  /** A soft tone when a star is chosen: lower when it is stuck. */
  ping(stuck: boolean, pr = 0): void {
    if (this.isOn()) this.score?.ping(stuck, pr);
  }

  /** A short crackle when a meteor lands, only while sound is on. */
  crackle(pan: number, strength: number, seed: number): void {
    if (this.isOn()) this.score?.crackle(pan, strength, seed);
  }

  /** A satellite's beep, at its state's pitch and panned by where it is on screen. */
  beep(pan: number, state: SatelliteState): void {
    if (this.isOn()) this.score?.beep(pan, BEEP_HZ[state]);
  }

  /** A boom for a pull request that merged, only while the sound is on. */
  merged(cue: MergeCue): void {
    if (this.isOn()) this.score?.merge(cue);
  }

  private play(): void {
    this.score ??= this.makeScore();
    this.score.setVolume(this.volume());
    this.score.start().catch((error: unknown) => this.errors.handleError(error));
  }
}

function parseVolume(stored: string | null): number {
  const v = stored === null ? NaN : parseFloat(stored);
  return v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
}
