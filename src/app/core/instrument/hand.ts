import { DEG } from './proportions';

/** What the hand adds to the core this frame. */
export interface HandPose {
  /** Turn added to the idle spin, about the upright, in radians. */
  readonly yaw: number;
  /** Tip toward or away from the viewer, in radians. */
  readonly pitch: number;
  /** Where the pointer is, in client pixels. */
  readonly x: number;
  readonly y: number;
  /** How lit the points round the pointer are, 0 to 1. */
  readonly glow: number;
}

export type PointerKind = 'mouse' | 'other';

export interface PointerSample {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Milliseconds, from the event. */
  readonly t: number;
  readonly kind: PointerKind;
}

export type NudgeDirection = 'left' | 'right' | 'up' | 'down';

/** A press that moves further than this, in CSS pixels, is a drag. A finger
 *  wobbles more than a mouse does. */
const SLOP_PX: Readonly<Record<PointerKind, number>> = { mouse: 5, other: 10 };
/** How fast a flick runs down, per second, and the fastest it may spin. */
const DRAG_PER_S = 1.8;
const MAX_SPIN = 14;
/** The last move is older than this at the release: the hand stopped before
 *  it let go, so the ball does not coast. */
const REST_MS = 80;
/** One arrow key's turn, and the fastest a held key may spin it: well under
 *  a flick's, since a key repeats about thirty times a second. */
const NUDGE = 18 * DEG;
const KEY_SPIN = 3;
const GLOW_RATE = 7;
const MAX_STEP_S = 0.1;
const SETTLED_SPIN = 0.01;
const SETTLED_GLOW = 0.002;
const NOWHERE = -1e4;

const NUDGES: Readonly<Record<NudgeDirection, readonly [number, number]>> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

const clampSpin = (value: number, top: number = MAX_SPIN): number =>
  Math.max(-top, Math.min(top, value));

interface Held {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  x: number;
  y: number;
  t: number;
}

/** The hand on the core: a drag turns the ball, a flick coasts and runs
 *  down, and the points round the pointer light. Only the ball turns. With
 *  motion off the ball still follows a drag and the glow still lights, but
 *  nothing coasts. `radius` is the ball's, in pixels. */
export class HandState {
  private yaw = 0;
  private pitch = 0;
  private spinYaw = 0;
  private spinPitch = 0;
  private x = NOWHERE;
  private y = NOWHERE;
  private isOver = false;
  private glow = 0;
  private lastWall: number | null = null;
  private held: Held | null = null;
  private dragged = false;

  /** `isStill` says whether motion is off, which stops coasting and pushing. */
  constructor(private readonly isStill: () => boolean) {}

  get pose(): HandPose {
    return { yaw: this.yaw, pitch: this.pitch, x: this.x, y: this.y, glow: this.glow };
  }

  /** True while the hand is doing anything the core should draw smoothly for. */
  get isBusy(): boolean {
    return (
      this.held !== null ||
      this.isOver ||
      this.spinYaw !== 0 ||
      this.spinPitch !== 0 ||
      this.glow > 0
    );
  }

  /** True once the current press has moved far enough to be a drag. */
  get hasDragged(): boolean {
    return this.dragged;
  }

  point(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.isOver = true;
  }

  leave(): void {
    if (!this.held) this.isOver = false;
  }

  /** Catching a spinning ball stops it. */
  press(sample: PointerSample): void {
    this.spinYaw = 0;
    this.spinPitch = 0;
    this.held = {
      id: sample.id,
      startX: sample.x,
      startY: sample.y,
      x: sample.x,
      y: sample.y,
      t: sample.t,
    };
    this.dragged = false;
    this.point(sample.x, sample.y);
  }

  /** A drag across the whole ball turns it half round. */
  move(sample: PointerSample, radius: number): void {
    this.point(sample.x, sample.y);
    const held = this.held;
    if (!held || held.id !== sample.id) return;
    const moved = Math.hypot(sample.x - held.startX, sample.y - held.startY);
    if (!this.dragged && moved < SLOP_PX[sample.kind]) return;
    this.dragged = true;
    const perPixel = Math.PI / (2 * Math.max(radius, 1));
    const dx = (sample.x - held.x) * perPixel;
    const dy = (sample.y - held.y) * perPixel;
    const dt = Math.max(0.008, (sample.t - held.t) / 1000);
    this.yaw += dx;
    this.pitch += dy;
    this.spinYaw = clampSpin(this.spinYaw * 0.4 + (dx / dt) * 0.6);
    this.spinPitch = clampSpin(this.spinPitch * 0.4 + (dy / dt) * 0.6);
    Object.assign(held, { x: sample.x, y: sample.y, t: sample.t });
  }

  /** `isOnBall` is whether the pointer is over the ball as it lets go: a
   *  finger lifted is gone, a mouse let go off the ball has left it. */
  release(sample: PointerSample, isOnBall: boolean): void {
    const held = this.held;
    if (!held || held.id !== sample.id) return;
    this.held = null;
    if (this.isStill() || sample.t - held.t > REST_MS) {
      this.spinYaw = 0;
      this.spinPitch = 0;
    }
    if (sample.kind !== 'mouse' || !isOnBall) this.isOver = false;
  }

  /** An arrow key: moving, a push that coasts one nudge's worth; still, the nudge itself. */
  nudge(direction: NudgeDirection): void {
    const [across, down] = NUDGES[direction];
    if (this.isStill()) {
      this.yaw += across * NUDGE;
      this.pitch += down * NUDGE;
      return;
    }
    this.spinYaw = clampSpin(this.spinYaw + across * NUDGE * DRAG_PER_S, KEY_SPIN);
    this.spinPitch = clampSpin(this.spinPitch + down * NUDGE * DRAG_PER_S, KEY_SPIN);
  }

  /** Runs a flick down and eases the glow, once a frame, on the wall clock. */
  advance(wall: number): void {
    const isStill = this.isStill();
    const dt = this.lastWall === null ? 0 : Math.min(MAX_STEP_S, Math.max(0, wall - this.lastWall));
    this.lastWall = wall;
    if (isStill) {
      this.spinYaw = 0;
      this.spinPitch = 0;
    }
    if (!this.held && !isStill) this.coast(dt);
    const want = this.isOver ? 1 : 0;
    this.glow = isStill ? want : this.glow + (want - this.glow) * (1 - Math.exp(-dt * GLOW_RATE));
    if (Math.abs(this.glow - want) < SETTLED_GLOW) this.glow = want;
  }

  private coast(dt: number): void {
    const turn = Math.PI * 2;
    this.yaw = (this.yaw + this.spinYaw * dt) % turn;
    this.pitch = (this.pitch + this.spinPitch * dt) % turn;
    const keep = Math.exp(-dt * DRAG_PER_S);
    this.spinYaw *= keep;
    this.spinPitch *= keep;
    if (Math.abs(this.spinYaw) + Math.abs(this.spinPitch) < SETTLED_SPIN) {
      this.spinYaw = 0;
      this.spinPitch = 0;
    }
  }
}

/** The glow's reach and the push, in ball radii; then how much brighter and
 *  larger a point right at the hand draws, and a line through it. */
export const HAND_REACH = 0.42;
export const HAND_PUSH = 0.07;
export const HAND_BRIGHT = 2.4;
export const HAND_GROW = 0.6;
export const HAND_LINE_BRIGHT = 3;

/** How near a point is to the hand, 1 at it and 0 from `reach` out. The 3D
 *  core's shader repeats this formula. */
export function nearness(distance: number, reach: number): number {
  const u = Math.min(1, distance / Math.max(reach, 1e-6));
  const k = 1 - u * u * (3 - 2 * u);
  return k * k;
}
