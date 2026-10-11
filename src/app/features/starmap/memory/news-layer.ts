import { rnd } from '../engine/rnd';
import { NewsEffect3D, SkyFrame, SkyLayer } from '../engine/sky-frame';
import { SkyStar } from '../engine/sky-model';
import { coolLook, coolProgress, sinkHead, sinkLook, sinkProgress } from './closed-ember';
import { drawCompany } from './company-draw';
import { DEPARTED_MAG, fromOf, streakTravel } from './departure-exit';
import { NOVA_FLASH, NOVA_RING, novaLook, novaProgress, streakProgress } from './merge-supernova';
import { hasExit } from './exits';
import { EFFECTS, NewsEvent } from './news';
import {
  COLLAPSE_CORE,
  COLLAPSE_RING,
  collapseLook,
  collapseProgress,
  squashStreakProgress,
} from './squash-collapse';

const ease = (p: number): number => 1 - Math.pow(1 - p, 3);

/** The sky's current news: the events, and whether they have been seen. */
export interface News {
  readonly events: readonly NewsEvent[];
  readonly acknowledged: boolean;
}

type Burst = (
  ev: NewsEvent,
  star: SkyStar | null,
  p: number,
  c: CanvasRenderingContext2D,
  at: [number, number],
  r: number,
  f: SkyFrame,
) => void;

/** A white flash and a four-point sparkle: something new was born. */
const burstNova: Burst = (ev, star, p, c, [sx, sy], r) => {
  c.globalAlpha = (1 - p) * 0.9;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(sx, sy, r * (1 + ease(p) * 5), 0, Math.PI * 2);
  c.fill();
  const len = r * 9 * (1 - p * 0.6);
  c.globalAlpha = 1 - p;
  c.strokeStyle = '#ffffff';
  c.lineWidth = Math.max(r * 0.12, 0.8);
  c.beginPath();
  for (const [a, k] of [
    [0, 1],
    [Math.PI / 2, 1],
    [Math.PI / 4, 0.45],
    [-Math.PI / 4, 0.45],
  ]) {
    c.moveTo(sx - Math.cos(a) * len * k, sy - Math.sin(a) * len * k);
    c.lineTo(sx + Math.cos(a) * len * k, sy + Math.sin(a) * len * k);
  }
  c.stroke();
};

/** A shockwave and debris: a branch that merged before no longer does. */
const burstSupernova: Burst = (ev, star, p, c, [sx, sy], r) => {
  const col = star?.colour ?? EFFECTS[ev.kind].colour;
  if (p < 0.25) {
    c.globalAlpha = 1 - p / 0.25;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(sx, sy, r * (2 + p * 14), 0, Math.PI * 2);
    c.fill();
  }
  for (const [lag, w] of [
    [0, 1],
    [0.12, 0.55],
  ]) {
    const q = Math.max(0, p - lag) / (1 - lag);
    if (q <= 0) continue;
    c.globalAlpha = (1 - q) * 0.85;
    c.strokeStyle = col;
    c.lineWidth = Math.max(r * 0.5 * w * (1 - q), 0.6);
    c.beginPath();
    c.arc(sx, sy, r * (2 + ease(q) * 24), 0, Math.PI * 2);
    c.stroke();
  }
  const rr = rnd(ev.pr * 7919);
  c.fillStyle = col;
  for (let i = 0; i < 22; i++) {
    const a = rr() * Math.PI * 2;
    const d = r * (3 + ease(p) * (12 + rr() * 16));
    c.globalAlpha = (1 - p) * (0.5 + rr() * 0.5);
    c.beginPath();
    c.arc(
      sx + Math.cos(a) * d,
      sy + Math.sin(a) * d * 0.8,
      Math.max(r * 0.12 * (1 - p), 0.5),
      0,
      Math.PI * 2,
    );
    c.fill();
  }
};

/** Rings falling inward: the pressure on a star has eased. */
const burstImplode: Burst = (ev, star, p, c, [sx, sy], r) => {
  for (let k = 0; k < 3; k++) {
    const q = Math.min(1, Math.max(0, p * 1.3 - k * 0.15));
    if (q <= 0 || q >= 1) continue;
    c.globalAlpha = Math.sin(q * Math.PI) * 0.7;
    c.strokeStyle = '#5fe3a1';
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(sx, sy, r * (1.2 + (1 - ease(q)) * 12), 0, Math.PI * 2);
    c.stroke();
  }
};

/** A pull request that left the sky crosses it once, from where it stood. */
const burstShooting: Burst = (ev, star, p, c, at, r, f) => {
  const [x0, y0] = f.toScreen(ev.fromX ?? 0, ev.fromY ?? 0, ev.fromZ ?? 0);
  const scale = Math.max(f.camera.current.scale, 0.5);
  const angle = ev.angle ?? 0;
  const hx = x0 + Math.cos(angle) * streakTravel(p) * scale;
  const hy = y0 + Math.sin(angle) * streakTravel(p) * scale;
  const tail = 170 * scale * (1 - p * 0.4);
  const tx = hx - Math.cos(angle) * tail;
  const ty = hy - Math.sin(angle) * tail;
  const g = c.createLinearGradient(tx, ty, hx, hy);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, EFFECTS[ev.kind].colour);
  c.globalAlpha = 1 - Math.pow(p, 3);
  c.strokeStyle = g;
  c.lineWidth = 2.4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(tx, ty);
  c.lineTo(hx, hy);
  c.stroke();
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(hx, hy, 2.6, 0, Math.PI * 2);
  c.fill();
  ev.head = [hx, hy];
};

/** Where a departed star stood on screen, and the size it is drawn at: it is gone, so there is none to measure. */
function departedAt(ev: NewsEvent, f: SkyFrame): { x: number; y: number; size: number } {
  const from = fromOf(ev);
  const [x, y] = f.toScreen(from.x, from.y, from.z);
  return { x, y, size: DEPARTED_MAG * Math.max(f.camera.current.scale, 0.42) };
}

const disc = (
  c: CanvasRenderingContext2D,
  [x, y]: [number, number],
  radius: number,
  colour: string,
  alpha: number,
): void => {
  c.globalAlpha = alpha;
  c.fillStyle = colour;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
};

const circle = (
  c: CanvasRenderingContext2D,
  [x, y]: [number, number],
  radius: number,
  colour: string,
  alpha: number,
  width: number,
): void => {
  c.globalAlpha = alpha;
  c.strokeStyle = colour;
  c.lineWidth = Math.max(width, 0.6);
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.stroke();
};

/** A white-gold flash and one ring of dust where the star stood, then the streak.
 *  With motion off only a brief flash plays: no ring, no streak. */
const burstMerged: Burst = (ev, star, p, c, at, r, f) => {
  const q = novaProgress(p);
  if (q !== null) {
    const { x, y, size } = departedAt(ev, f);
    const look = novaLook(q);
    disc(c, [x, y], size * look.flashRadius, NOVA_FLASH, look.flashAlpha);
    if (!f.frozen) {
      circle(c, [x, y], size * look.ringRadius, NOVA_RING, look.ringAlpha, size * 0.45 * (1 - q));
    }
  }
  const sp = streakProgress(p);
  if (sp > 0 && sp < 1 && !f.frozen) burstShooting(ev, star, sp, c, at, r, f);
};

/** A ring falls in on the star, which shrinks to a point, flashes once, and streaks away.
 *  With motion off only the core and the flash play: no ring, no streak. */
const burstSquashed: Burst = (ev, star, p, c, at, r, f) => {
  const q = collapseProgress(p);
  if (q !== null) {
    const { x, y, size } = departedAt(ev, f);
    const look = collapseLook(q);
    if (!f.frozen) {
      circle(c, [x, y], size * look.ringRadius, COLLAPSE_RING, look.ringAlpha, size * 0.3);
    }
    disc(c, [x, y], size * look.coreRadius, COLLAPSE_CORE, look.coreAlpha);
    disc(c, [x, y], size * look.flashRadius, '#ffffff', look.flashAlpha);
  }
  const sp = squashStreakProgress(p);
  if (sp > 0 && sp < 1 && !f.frozen) burstShooting(ev, star, sp, c, at, r, f);
};

/** A glow and a fainter halo round it, the ember's whole look. */
const ember = (
  c: CanvasRenderingContext2D,
  at: [number, number],
  radius: number,
  colour: string,
  alpha: number,
): void => {
  disc(c, at, radius * 1.9, colour, alpha * 0.22);
  disc(c, at, radius, colour, alpha);
};

/** The star cools to an ember where it stood, then sinks into the black hole.
 *  With motion off only the cooling plays: it does not sink. */
const burstClosed: Burst = (ev, star, p, c, at, r, f) => {
  const q = coolProgress(p);
  if (q !== null) {
    const { x, y, size } = departedAt(ev, f);
    const look = coolLook(q);
    ember(c, [x, y], size * look.radius, look.colour, look.alpha);
    ev.head = [x, y];
  }
  const s = sinkProgress(p);
  if (s > 0 && s < 1 && !f.frozen) {
    const head = sinkHead(fromOf(ev), s);
    const place = f.toScreen(head.x, head.y, head.z);
    const look = sinkLook(s);
    ember(
      c,
      place,
      DEPARTED_MAG * Math.max(f.camera.current.scale, 0.42) * look.radius,
      look.colour,
      look.alpha,
    );
    ev.head = place;
  }
};

const BURSTS: Readonly<Record<NewsEvent['kind'], Burst>> = {
  blocked: burstSupernova,
  opened: burstNova,
  merged: burstMerged,
  squashed: burstSquashed,
  unblocked: burstImplode,
  closed: burstClosed,
  left: burstShooting,
};

const MODES: Readonly<Record<NewsEvent['kind'], NewsEffect3D['mode']>> = {
  blocked: 'supernova',
  opened: 'nova',
  merged: 'merged',
  squashed: 'squashed',
  unblocked: 'implode',
  closed: 'closed',
  left: 'shooting',
};

/** Lingers until acknowledged: a slow dashed ring in the change's colour. */
function markRing(
  ev: NewsEvent,
  t: number,
  c: CanvasRenderingContext2D,
  [sx, sy]: [number, number],
  r: number,
): void {
  const fx = EFFECTS[ev.kind];
  if (!fx.mark) return;
  c.globalAlpha = 0.55 + Math.sin(t * 2.1) * 0.2;
  c.strokeStyle = fx.colour;
  c.lineWidth = 1.2;
  c.setLineDash([...fx.mark]);
  c.lineDashOffset = t * 12;
  c.beginPath();
  c.arc(sx, sy, r * 1.9 + 10, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
}

const starsByPr = (stars: readonly SkyStar[]): Map<number, SkyStar> =>
  new Map(stars.filter((s) => s.item).map((s) => [s.item?.pr as number, s]));

/** How far through its burst an event is: 1 when still, or not yet played. */
const progress = (ev: NewsEvent, f: SkyFrame): number => {
  const fx = EFFECTS[ev.kind];
  return ev.startAt == null || (f.frozen && !fx.flashesStill) ? 1 : (f.wall - ev.startAt) / fx.span;
};

/**
 * The review queue's news on the sky: bursts as each change plays, rings that
 * linger until seen, and a tag over each. In 3D the bursts are the scene's;
 * the rings and words stay on the overlay.
 */
export class NewsLayer implements SkyLayer {
  news: News = { events: [], acknowledged: false };

  above(c: CanvasRenderingContext2D, f: SkyFrame): void {
    if (f.chart !== 'prs') return;
    const byPr = starsByPr(f.stars);
    const bursts = f.renderer === 'canvas';
    const scale = Math.max(f.camera.current.scale, 0.42);
    for (const ev of this.news.events) {
      const fx = EFFECTS[ev.kind];
      const star = fx.onStar ? (byPr.get(ev.pr) ?? null) : null;
      if (fx.onStar && !star) continue;
      const at: [number, number] = star ? f.toScreen(star.ax, star.ay, star.az) : [0, 0];
      const r = star ? star.mag * scale : 0;
      c.save();
      if (!this.news.acknowledged && fx.mark && star) markRing(ev, f.t, c, at, r);
      const p = progress(ev, f);
      if (bursts && p > 0 && p < 1) BURSTS[ev.kind](ev, star, p, c, at, r, f);
      c.restore();
    }
  }

  /** The company of a star that is leaving, flat over both skies: it plays before the star goes. */
  flat(c: CanvasRenderingContext2D, f: SkyFrame): void {
    if (f.chart !== 'prs') return;
    for (const ev of this.news.events) {
      if (hasExit(ev.kind)) drawCompany(c, f, ev, departedAt(ev, f));
    }
  }

  labels(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    if (f.chart !== 'prs') return;
    const byPr = starsByPr(f.stars);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 9.5px "IBM Plex Mono", monospace';
    // Neighbouring stars often change together; a tag that would land on one
    // already drawn is dropped rather than stacked: the ring still marks it.
    const placed: { x: number; y: number; w: number }[] = [];
    const clear = (x: number, y: number, w: number): boolean => {
      if (placed.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 4 && Math.abs(b.y - y) < 12)) {
        return false;
      }
      placed.push({ x, y, w });
      return true;
    };
    for (const ev of this.news.events) {
      const fx = EFFECTS[ev.kind];
      if (fx.onStar) {
        const star = byPr.get(ev.pr);
        if (!star || this.news.acknowledged || f.camera.current.scale < 0.3) continue;
        const [sx, sy] = f.toScreen(star.ax, star.ay, star.az);
        const r = star.mag * Math.max(f.camera.current.scale, 0.42);
        const y = sy - r * 1.9 - 16;
        if (!clear(sx, y, ctx.measureText(fx.tag).width)) continue;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = fx.colour;
        ctx.fillText(fx.tag, sx, y);
      } else if (ev.head && !f.frozen) {
        const p = progress(ev, f);
        if (p <= 0 || p >= 1) continue;
        ctx.globalAlpha = Math.sin(p * Math.PI);
        ctx.fillStyle = fx.colour;
        ctx.fillText(`#${ev.pr} ${fx.tag}`, ev.head[0], ev.head[1] - 12);
      }
    }
    ctx.restore();
  }

  /** Whether a burst is still to play or playing, so a still sky keeps drawing it. */
  animating(wall: number): boolean {
    return this.news.events.some((ev) => {
      const fx = EFFECTS[ev.kind];
      return fx.flashesStill && ev.startAt != null && wall < ev.startAt + fx.span;
    });
  }

  /** The bursts playing now, for the 3D scene to build. */
  effects3D(f: SkyFrame): NewsEffect3D[] {
    if (f.chart !== 'prs') return [];
    const byPr = starsByPr(f.stars);
    const playing: NewsEffect3D[] = [];
    for (const ev of this.news.events) {
      const fx = EFFECTS[ev.kind];
      const p = progress(ev, f);
      const star = fx.onStar ? byPr.get(ev.pr) : undefined;
      if (p <= 0 || p >= 1 || (fx.onStar && !star)) continue;
      playing.push({
        key: ev,
        mode: MODES[ev.kind],
        p,
        still: f.frozen,
        star: star ?? null,
        colour: fx.colour,
        seed: ev.pr,
        from: { x: ev.fromX ?? 0, y: ev.fromY ?? 0, z: ev.fromZ ?? 0 },
        angle: ev.angle ?? 0,
        onHead: (head) => (ev.head = head),
      });
    }
    return playing;
  }
}
