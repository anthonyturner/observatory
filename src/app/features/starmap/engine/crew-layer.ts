import { CrewMark } from '../../../core/crew/crew.types';
import { starRadius } from './canvas-sky';
import { SkyFrame, SkyLayer } from './sky-frame';

/** How long a returning crew takes to fly off, and how long its tick or cross stays after. */
export const LEAVE_MS = 4_000;
export const SHOW_ENDED_MS = 10 * 60_000;

/** Radians a second round the star; where a still sky parks the ship. */
const ORBIT_SPEED = 0.7;
const STILL_ANGLE = -Math.PI / 4;
/** The orbit clears the outermost planet (3.7 × the star's radius), and is tilted like the gas disc. */
const ORBIT_REACH = 4.4;
const ORBIT_MIN_PX = 18;
const ORBIT_MAX_PX = 80;
const ORBIT_TILT = 0.45;
/** How far a leaving ship flies, in orbits. */
const LEAVE_REACH = 3;

const HULL = '#e8eefa';
const HULL_EDGE = '#3a4566';
const VISOR = '#6fd4ff';
const FINS = '#ff9a3d';
const FLAME = '#ffd27a';
const OK = '#5fe3a1';
const BAD = '#ff6f5e';

/** Where a crew's ship is, relative to its star, and what shows with it. */
export interface CrewPose {
  /** The ship's offset from the star and heading, or null once it has gone. */
  readonly ship: {
    readonly dx: number;
    readonly dy: number;
    readonly heading: number;
    readonly alpha: number;
  } | null;
  readonly isFlying: boolean;
  /** A tick or a cross by the star once the run has ended. */
  readonly badge: 'ok' | 'bad' | null;
}

/** What a pose depends on besides the mark. */
export interface PoseClock {
  readonly t: number;
  readonly frozen: boolean;
  readonly now: number;
  readonly orbit: number;
}

function orbitPoint(angle: number, orbit: number): { dx: number; dy: number; heading: number } {
  const dx = Math.cos(angle) * orbit;
  const dy = Math.sin(angle) * orbit * ORBIT_TILT;
  const heading = Math.atan2(Math.cos(angle) * orbit * ORBIT_TILT, -Math.sin(angle) * orbit);
  return { dx, dy, heading };
}

/** A working crew circles its star, or waits parked when motion is off; an
 *  ended one flies off and leaves a tick or cross for a while. */
export function crewPose(mark: CrewMark, clock: PoseClock): CrewPose | null {
  if (mark.phase === 'working') {
    const angle = clock.frozen ? STILL_ANGLE : clock.t * ORBIT_SPEED;
    return {
      ship: { ...orbitPoint(angle, clock.orbit), alpha: 1 },
      isFlying: !clock.frozen,
      badge: null,
    };
  }
  const since = clock.now - (mark.endedAt ?? clock.now);
  if (since >= SHOW_ENDED_MS) return null;
  const badge = mark.phase === 'succeeded' ? 'ok' : 'bad';
  if (clock.frozen || since >= LEAVE_MS) return { ship: null, isFlying: false, badge };
  const p = since / LEAVE_MS;
  const out = clock.orbit * (1 + LEAVE_REACH * p * p);
  const away = STILL_ANGLE;
  return {
    ship: {
      dx: Math.cos(away) * out,
      dy: Math.sin(away) * out,
      heading: away,
      alpha: 1 - p,
    },
    isFlying: true,
    badge,
  };
}

/**
 * The crew ships: a small astronaut ship by each star a crew is working on,
 * drawn flat over both renderers. A still sky only redraws when asked, so the
 * layer asks once a returned crew's tick or cross is due to go.
 */
export class CrewLayer implements SkyLayer {
  private marks: readonly CrewMark[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly now: () => number,
    private readonly redraw: () => void,
  ) {}

  set(marks: readonly CrewMark[]): void {
    this.marks = marks;
    this.schedule();
    this.redraw();
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  flat(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    if (f.chart !== 'prs' || !this.marks.length) return;
    const now = this.now();
    for (const mark of this.marks) {
      const star = f.stars.find((each) => each.item?.pr === mark.pr);
      if (!star) continue;
      const orbit = Math.min(
        Math.max(starRadius(f, star, 1) * ORBIT_REACH, ORBIT_MIN_PX),
        ORBIT_MAX_PX,
      );
      const pose = crewPose(mark, { t: f.t, frozen: f.frozen, now, orbit });
      if (!pose) continue;
      const [x, y] = f.toScreen(star.ax, star.ay, star.az);
      if (pose.badge) drawBadge(ctx, x + orbit * 0.7, y - orbit * 0.7, pose.badge);
      if (pose.ship) drawShip(ctx, x + pose.ship.dx, y + pose.ship.dy, pose, f.t);
    }
  }

  private schedule(): void {
    this.dispose();
    const now = this.now();
    const due = this.marks
      .filter((mark) => mark.endedAt !== null && now - mark.endedAt < SHOW_ENDED_MS)
      .map((mark) => (mark.endedAt ?? now) + SHOW_ENDED_MS - now);
    if (!due.length) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        this.redraw();
        this.schedule();
      },
      Math.min(...due) + 1,
    );
  }
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: CrewPose,
  t: number,
): void {
  const ship = pose.ship;
  if (!ship) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ship.heading);
  ctx.globalAlpha = ship.alpha;
  if (pose.isFlying) {
    ctx.fillStyle = FLAME;
    ctx.globalAlpha = ship.alpha * (0.6 + 0.3 * Math.sin(t * 23));
    ctx.beginPath();
    ctx.moveTo(-6, -1.6);
    ctx.lineTo(-10.5, 0);
    ctx.lineTo(-6, 1.6);
    ctx.fill();
    ctx.globalAlpha = ship.alpha;
  }
  ctx.fillStyle = FINS;
  ctx.beginPath();
  ctx.moveTo(-5, -2.5);
  ctx.lineTo(-7, -5);
  ctx.lineTo(-2, -2.5);
  ctx.moveTo(-5, 2.5);
  ctx.lineTo(-7, 5);
  ctx.lineTo(-2, 2.5);
  ctx.fill();
  ctx.fillStyle = HULL;
  ctx.strokeStyle = HULL_EDGE;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = VISOR;
  ctx.beginPath();
  ctx.arc(2.6, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, badge: 'ok' | 'bad'): void {
  const colour = badge === 'ok' ? OK : BAD;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = 'rgba(10, 14, 30, 0.75)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  if (badge === 'ok') {
    ctx.moveTo(x - 2.4, y);
    ctx.lineTo(x - 0.6, y + 2);
    ctx.lineTo(x + 2.6, y - 2);
  } else {
    ctx.moveTo(x - 2, y - 2);
    ctx.lineTo(x + 2, y + 2);
    ctx.moveTo(x + 2, y - 2);
    ctx.lineTo(x - 2, y + 2);
  }
  ctx.stroke();
  ctx.restore();
}
