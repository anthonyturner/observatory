const TAU = Math.PI * 2;

/** Left alone the Earth turns once in two minutes, eastward: slow enough to be scenery. */
export const IDLE_TURN = TAU / 120;
/** After a let-go the turn eases back to the idle rate over about this long. */
const SETTLE_SECONDS = 2;
/** The share of the gap to the idle rate still open after `SETTLE_SECONDS`. */
const SETTLE_REMAINING = 0.02;
/** A hard flick spins the Earth at most this fast, in radians a second: a turn and a half. */
const MAX_TURN = TAU * 1.5;

/**
 * How far the Earth has turned about its axis, in radians eastward. A drag
 * sets how fast it turns, and once the pointer lets go that speed decays to the
 * idle rate, the way a flick on the camera drifts to a stop. It turns the
 * Earth, never the camera.
 */
export class EarthSpin {
  private turned = 0;
  private speed = IDLE_TURN;
  private pending = 0;

  /** The angle the Earth has turned to, eastward, in [0, 2π). */
  get angle(): number {
    return this.turned;
  }

  /** The ground follows the pointer: a drag of `pixels` to the right, on an Earth of `radius` pixels, turns it east by pixels / radius radians. */
  drag(pixels: number, radius: number): void {
    this.pending += pixels / radius;
  }

  /**
   * Moves the Earth on by `dt` seconds. While `isDragging` it turns by what
   * the pointer has dragged since the last frame, and takes that as its speed.
   * Let go, it settles to the idle rate. With no `hasMotion` it only follows a
   * drag: no idle spin and no inertia.
   */
  advance(dt: number, isDragging: boolean, hasMotion: boolean): void {
    const dragged = this.pending;
    this.pending = 0;
    this.turnBy(dragged);
    if (!hasMotion) {
      this.speed = 0;
    } else if (isDragging) {
      if (dt > 0) this.speed = Math.max(-MAX_TURN, Math.min(MAX_TURN, dragged / dt));
    } else {
      const keep = Math.pow(SETTLE_REMAINING, dt / SETTLE_SECONDS);
      this.speed = IDLE_TURN + (this.speed - IDLE_TURN) * keep;
      this.turnBy(this.speed * dt);
    }
  }

  private turnBy(radians: number): void {
    this.turned = (((this.turned + radians) % TAU) + TAU) % TAU;
  }
}
