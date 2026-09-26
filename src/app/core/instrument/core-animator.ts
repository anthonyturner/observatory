import { Bead } from './beads';
import { CoreLook, Rgb, breathing, nextLook, tierSpin } from './core-look';
import { CoreMood, UNEASY_WARMTH, UNKNOWN_GREY, withMood } from './core-mood';
import { CoreFrame } from './core-renderer';
import { CORE_STATES, CoreInk, TierLevels } from './core-states';
import { easeOut } from './easing';
import { BALL } from './proportions';

/** How the core draws this frame, the same for every renderer. */
export interface CorePose {
  readonly look: CoreLook;
  /** 0 to 1 as the core grows in on load. */
  readonly intro: number;
  /** The ball's size as it breathes, about 1. */
  readonly breath: number;
  readonly tierLevels: TierLevels;
  readonly tierSpin: number;
  /** Real seconds since the first frame. */
  readonly sinceStart: number;
  /** Real seconds since the beads started growing in. */
  readonly sinceBeads: number;
  readonly isStill: boolean;
}

/** The core grows in over this long on load. */
const INTRO_S = 1.6;
/** Each bead grows in over this long, after its own delay. */
const BEAD_GROW_S = 0.8;
/** The ball starts at this fraction of its size and grows to full with the intro. */
const BALL_START = 0.55;
/** Until the speaking state is wired to a reply, it lights the first tier. */
const SPOKEN_TIER = 0;

/** Carries the core's look from frame to frame: easing between states, the
 *  intro and the beads growing in. Renderers only draw the pose it gives. */
export class CoreAnimator {
  private look: CoreLook | null = null;
  private startWall: number | null = null;
  private beadsWall: number | null = null;
  private current: CorePose | null = null;

  get pose(): CorePose | null {
    return this.current;
  }

  /** Grows the beads in again from the next frame, as when the first projects arrive. */
  replayBeads(): void {
    this.beadsWall = null;
  }

  advance(frame: CoreFrame, inks: Readonly<Record<CoreInk, Rgb>>): void {
    const state = withMood(CORE_STATES[frame.state], frame.mood);
    this.startWall ??= frame.wall;
    this.beadsWall ??= frame.wall;
    this.look = nextLook(this.look, {
      state,
      tint: moodTint(inks, inks[state.tint], frame.mood),
      time: frame.time,
      wall: frame.wall,
      isStill: frame.isStill,
    });
    const sinceStart = frame.wall - this.startWall;
    this.current = {
      look: this.look,
      intro: frame.isStill ? 1 : easeOut(sinceStart / INTRO_S),
      breath: breathing(state, frame.time),
      tierLevels: state.tiers({
        time: frame.time,
        age: frame.stateAge,
        isStill: frame.isStill,
        spokenTier: SPOKEN_TIER,
      }),
      tierSpin: tierSpin(state, frame.time),
      sinceStart,
      sinceBeads: frame.wall - this.beadsWall,
      isStill: frame.isStill,
    };
  }
}

/** The ball's radius in pixels: breathing, and growing in with the intro. */
export const ballRadiusOf = (pose: CorePose, coreRadius: number): number =>
  coreRadius * BALL * pose.breath * (BALL_START + (1 - BALL_START) * pose.intro);

/** How far a bead has grown in, 0 to 1. */
export const beadGrowth = (pose: CorePose, bead: Bead): number =>
  pose.isStill ? 1 : easeOut((pose.sinceBeads - bead.delay) / BEAD_GROW_S);

/** The state's tint, warmed toward amber as the projects strain, or greyed
 *  while they are unknown, so unknown never looks like calm. */
function moodTint(inks: Readonly<Record<CoreInk, Rgb>>, tint: Rgb, mood: CoreMood): Rgb {
  const toward = mood.name === 'unknown' ? inks['--core-unknown'] : inks['--core-uneasy'];
  const amount = mood.name === 'unknown' ? UNKNOWN_GREY : mood.stress * UNEASY_WARMTH;
  const channel = (i: number): number => tint[i] + (toward[i] - tint[i]) * amount;
  return [channel(0), channel(1), channel(2)];
}
