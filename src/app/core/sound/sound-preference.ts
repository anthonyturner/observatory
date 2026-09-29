import {
  DOCUMENT,
  DestroyRef,
  ErrorHandler,
  Injectable,
  InjectionToken,
  Injector,
  Signal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CORE_MOOD } from '../instrument/core-tokens';
import { uneaseOf } from './ambient-score';
import { LitProject } from '../projects/lit-project';
import { PROJECTS } from '../projects/projects-source';
import { TalkState } from '../voice/talk-state';
import { AmbientPlayer, AmbientSynth } from './ambient-synth';
import { homeVoicesOf } from './home-voices';

/** Makes the player the Sound button drives. */
export const AMBIENT_PLAYER = new InjectionToken<() => AmbientPlayer>('AMBIENT_PLAYER', {
  providedIn: 'root',
  factory: () => {
    // Read the projects only when a score is made, so a page that shows the
    // Sound button without ever playing never starts the projects feed.
    const injector = inject(Injector);
    return () => {
      const projects = injector.get(PROJECTS);
      const lit = injector.get(LitProject);
      const voices = computed(() => homeVoicesOf(projects()));
      return new AmbientSynth({ voices: () => voices(), lit: () => lit.key() });
    };
  },
});

const STORAGE_KEY = 'observatory.sound';
const VOLUME_KEY = 'observatory.sound.volume';
const DEFAULT_VOLUME = 0.6;
const GESTURES = ['pointerdown', 'keydown'] as const;

/** Whether the page's score plays. Off until asked for: browsers refuse
 *  audio before a gesture, and a page that makes noise nobody chose is closed.
 *  Each page provides its own, with its own score, so leaving a page stops its
 *  music; the on/off choice is shared. The root one plays Home's score. */
@Injectable({ providedIn: 'root' })
export class SoundPreference {
  private readonly wanted = signal(readStoredChoice());
  private readonly makePlayer = inject(AMBIENT_PLAYER);
  private readonly errors = inject(ErrorHandler);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mood = inject(CORE_MOOD);
  private readonly talk = inject(TalkState);
  private player: AmbientPlayer | null = null;

  readonly isOn: Signal<boolean> = this.wanted.asReadonly();
  private readonly level = signal(readStoredVolume());
  /** How loud, 0 to 1, for a page with a volume slider. */
  readonly volume: Signal<number> = this.level.asReadonly();

  constructor() {
    if (this.wanted()) this.resume();
    this.destroyRef.onDestroy(() => this.player?.dispose());
    effect(() => {
      const unease = uneaseOf(this.mood());
      this.player?.setUnease?.(unease);
    });
    // The music steps back while someone talks, so the mic hears them rather than it.
    effect(() => {
      const talking = this.talk.isTalking();
      this.player?.setDucked?.(talking);
    });
  }

  toggle(): void {
    this.wanted.update((on) => !on);
    storeChoice(this.wanted());
    if (this.wanted()) this.play();
    else this.player?.stop();
  }

  setVolume(volume: number): void {
    const level = Math.min(1, Math.max(0, volume));
    this.level.set(level);
    storeVolume(level);
    this.player?.setVolume?.(level);
  }

  private play(): void {
    this.player ??= this.makePlayer();
    this.player.setVolume?.(this.level());
    this.player.setUnease?.(uneaseOf(this.mood()));
    this.player.setDucked?.(this.talk.isTalking());
    this.player.start().catch((error: unknown) => this.errors.handleError(error));
  }

  /** Someone who left sound on gets it back as soon as the browser allows:
   *  at once if they have already touched this page (as when they arrive
   *  from another page of the site), or on their first touch. */
  private resume(): void {
    if (this.document.defaultView?.navigator.userActivation?.hasBeenActive) this.play();
    else this.resumeOnFirstGesture();
  }

  private resumeOnFirstGesture(): void {
    const window = this.document.defaultView;
    const resume = (): void => {
      unlisten();
      if (this.wanted()) this.play();
    };
    const unlisten = (): void =>
      GESTURES.forEach((gesture) => window?.removeEventListener(gesture, resume));
    GESTURES.forEach((gesture) => window?.addEventListener(gesture, resume));
    this.destroyRef.onDestroy(unlisten);
  }
}

/** Private windows and blocked site data throw here; sound then starts off. */
function readStoredChoice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Where storage is blocked the choice lasts for this visit only. */
function storeChoice(isOn: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isOn ? 'on' : 'off');
  } catch {
    return;
  }
}

/** The volume last chosen, or the default where there is none or storage is blocked. */
function readStoredVolume(): number {
  try {
    const stored = Number(localStorage.getItem(VOLUME_KEY) ?? Number.NaN);
    return stored >= 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

function storeVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    return;
  }
}
