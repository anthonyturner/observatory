import { HOLE, fallOf } from './black-hole';
import { starRadius } from './canvas-sky';
import { SkyFrame, SkyLayer } from './sky-frame';
import { SkyStar } from './sky-model';

/** The shadow's radius in world units, and the fewest pixels it shrinks to when zoomed out. */
const SHADOW_RADIUS = 40;
const SHADOW_MIN_PX = 7;
/** The accretion disc's rings, in shadow radii, and how flat its tilt draws it. */
const DISC_INNER = 1.5;
const DISC_OUTER = 3.2;
const DISC_RINGS = 6;
const DISC_SEGMENTS = 40;
const DISC_TILT = 0.3;
/** Radians a second the inner ring turns; outer rings turn slower. */
const DISC_SPEED = 0.5;
const DISC_HOT = [255, 214, 160] as const;
const DISC_COOL = [255, 70, 40] as const;
const PHOTON_RING = 'rgba(255, 196, 140, 0.85)';
/** The longest a falling star's light stretches toward the hole, in pixels. */
const STRETCH_MAX_PX = 90;
/** How fast the specks of light stream from a falling star into the hole. */
const STREAM_SPEED = 0.18;
const STREAM_SPECKS = 3;
const STRETCH_RED = 'rgba(255, 48, 32, 0)';

/** The hole as the screen sees it this frame. */
interface HoleOnScreen {
  readonly x: number;
  readonly y: number;
  /** The shadow's radius in pixels. */
  readonly radius: number;
}

function holeOnScreen(f: SkyFrame): HoleOnScreen {
  const [x, y] = f.toScreen(HOLE.x, HOLE.y, 0);
  const [edge] = f.toScreen(HOLE.x + SHADOW_RADIUS, HOLE.y, 0);
  return { x, y, radius: Math.max(Math.abs(edge - x), SHADOW_MIN_PX) };
}

const mixInk = (share: number, alpha: number): string => {
  const [r, g, b] = DISC_HOT.map((hot, i) => Math.round(hot + (DISC_COOL[i] - hot) * share));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Half the accretion disc: the far half passes behind the shadow and the near
 * half in front of it. Streaks swirl round it, and the side turning toward the
 * viewer is brighter, as a real disc's is.
 */
function drawDisc(
  ctx: CanvasRenderingContext2D,
  hole: HoleOnScreen,
  t: number,
  half: 'far' | 'near',
): void {
  const from = half === 'far' ? Math.PI : 0;
  const step = Math.PI / DISC_SEGMENTS;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let ring = 0; ring < DISC_RINGS; ring++) {
    const share = ring / (DISC_RINGS - 1);
    const radius = hole.radius * (DISC_INNER + (DISC_OUTER - DISC_INNER) * share);
    const turn = t * DISC_SPEED * (1 - share * 0.6);
    ctx.lineWidth = Math.max(hole.radius * 0.28, 1.2);
    for (let i = 0; i < DISC_SEGMENTS; i++) {
      const a = from + i * step;
      const streak = 0.55 + 0.45 * Math.sin(a * 3 + ring * 1.7 - turn * 3);
      const beaming = 0.6 + 0.4 * Math.cos(a);
      ctx.strokeStyle = mixInk(share, (1 - share * 0.7) * streak * beaming * 0.5);
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y, radius, radius * DISC_TILT, 0, a, a + step * 1.05);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The shadow: black, edged by a thin ring of bent light. */
function drawShadow(ctx: CanvasRenderingContext2D, hole: HoleOnScreen): void {
  ctx.save();
  const halo = ctx.createRadialGradient(
    hole.x,
    hole.y,
    hole.radius,
    hole.x,
    hole.y,
    hole.radius * 1.6,
  );
  halo.addColorStop(0, 'rgba(255, 150, 90, 0.35)');
  halo.addColorStop(1, 'rgba(255, 80, 40, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PHOTON_RING;
  ctx.lineWidth = Math.max(hole.radius * 0.07, 1);
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius * 1.04, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * The black hole at the review queue's centre, and the light of each pull
 * request falling toward it, stretched out and reddening on the side that
 * faces the hole. Drawn flat over both renderers; it moves only with the
 * scene's time, so it holds still when motion is off.
 */
export class BlackHoleLayer implements SkyLayer {
  /** Idle days past which a pull request falls; with none, nothing does. */
  staleAfterDays = Number.POSITIVE_INFINITY;

  flat(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    if (f.chart !== 'prs' || !f.stars.length) return;
    const hole = holeOnScreen(f);
    for (const star of f.stars) this.drawStretch(ctx, f, star, hole);
    drawDisc(ctx, hole, f.t, 'far');
    drawShadow(ctx, hole);
    drawDisc(ctx, hole, f.t, 'near');
  }

  private drawStretch(
    ctx: CanvasRenderingContext2D,
    f: SkyFrame,
    star: SkyStar,
    hole: HoleOnScreen,
  ): void {
    const pull = star.item ? fallOf(star.item.idleDays, this.staleAfterDays) : 0;
    const grow = f.born(star);
    if (pull <= 0 || grow <= 0) return;
    const [x, y] = f.toScreen(star.ax, star.ay, star.az);
    const toHole = Math.hypot(hole.x - x, hole.y - y);
    if (toHole < 1) return;
    const core = starRadius(f, star, grow);
    const length = core + pull * Math.min(toHole * 0.4, STRETCH_MAX_PX);
    const alpha = f.dim(star) * grow * (0.25 + 0.45 * pull);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(hole.y - y, hole.x - x));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    const smear = ctx.createLinearGradient(-core * 0.6, 0, length, 0);
    smear.addColorStop(0, star.colour);
    smear.addColorStop(1, STRETCH_RED);
    ctx.fillStyle = smear;
    ctx.beginPath();
    ctx.ellipse(
      (length - core * 0.6) / 2,
      0,
      (length + core * 0.6) / 2,
      core * 0.38,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = 'rgb(255, 110, 70)';
    for (let i = 0; i < STREAM_SPECKS; i++) {
      const along = (f.t * STREAM_SPEED + i / STREAM_SPECKS + star.spin) % 1;
      ctx.globalAlpha = alpha * (1 - along);
      ctx.beginPath();
      ctx.arc(core + along * (length - core), 0, Math.max(core * 0.12, 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
