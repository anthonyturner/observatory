import { LandedBase, StackLink, Stacks, linksOf } from '../../../core/queue/stacks';
import { starRadius } from './canvas-sky';
import { starsByPr } from './collision-layer';
import { LINK_GAP } from './link-ink';
import { SkyFrame, SkyLayer } from './sky-frame';
import { SkyStar } from './sky-model';

/** A pull request stacked on one that has merged, as the sky marks it. */
export interface LandedMark {
  readonly pr: number;
  readonly landed: LandedBase;
}

/** One link of a drawn chain: where it sits on screen, and whether it is seen face on or edge on. */
export interface ChainLink {
  readonly x: number;
  readonly y: number;
  readonly isFaceOn: boolean;
}

/** The chain's links, in screen pixels; they keep their size at every zoom so a chain reads as a mark. */
const LINK_STEP = 11;
const LINK_HALF_LENGTH = 6;
const LINK_HALF_WIDTH = 3.2;
const INK = '#c9d3ea';
const LANDED_INK = '#ffcf7a';
/** The broken chain left on a pull request whose base merged: how many links, pointing up and left. */
const STUB_LINKS = 4;
const STUB_ANGLE = (-3 * Math.PI) / 4;
/** The glint that runs each chain toward the base it merges into, in chains a second. */
const GLINT_SPEED = 0.3;
const GLINT_REACH = 14;
const LABEL_MIN_SCALE = 0.3;

/**
 * The links of a chain from (x0, y0) to (x1, y1), one every LINK_STEP pixels,
 * alternately face on and edge on as a real chain hangs. None when the ends
 * are closer than one step.
 */
export function chainLinks(x0: number, y0: number, x1: number, y1: number): ChainLink[] {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const count = Math.floor(length / LINK_STEP);
  if (count < 1) return [];
  const lead = (length - (count - 1) * LINK_STEP) / 2;
  return Array.from({ length: count }, (_, i) => {
    const u = (lead + i * LINK_STEP) / length;
    return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, isFaceOn: i % 2 === 0 };
  });
}

/**
 * Stacked pull requests: a chain from each to the open pull request it merges
 * into, with a glint running toward the base, and a broken chain on one whose
 * base has merged, where a crew can update it. Drawn flat over both renderers,
 * in screen pixels. Its links set it apart from a collision thread, a binary's
 * twisted strands and the merge plan's gold path.
 */
export class StackLayer implements SkyLayer {
  links: readonly StackLink[] = [];
  landed: readonly LandedMark[] = [];
  /** Replay shows the queue as it was; the stacks are the queue as it is. */
  paused = false;

  /** Draws `stacks` from the next frame. */
  set(stacks: Stacks): void {
    this.links = linksOf(stacks);
    this.landed = [...stacks].flatMap(([pr, note]) =>
      note.landed ? [{ pr, landed: note.landed }] : [],
    );
  }

  flat(c: CanvasRenderingContext2D, f: SkyFrame): void {
    if (!this.isShown(f)) return;
    const byPr = starsByPr(f.stars);
    c.save();
    c.lineCap = 'round';
    for (const link of this.links) {
      const child = byPr.get(link.child);
      const parent = byPr.get(link.parent);
      if (child && parent) this.drawChain(c, f, child, parent);
    }
    for (const mark of this.landed) {
      const star = byPr.get(mark.pr);
      if (star) this.drawStub(c, f, star);
    }
    c.restore();
  }

  labels(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    if (!this.isShown(f) || !this.landed.length || f.camera.current.scale < LABEL_MIN_SCALE) return;
    const byPr = starsByPr(f.stars);
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '600 9.5px "IBM Plex Mono", monospace';
    ctx.fillStyle = LANDED_INK;
    for (const mark of this.landed) {
      const star = byPr.get(mark.pr);
      if (!star) continue;
      const [x, y] = this.stubEnd(f, star);
      ctx.globalAlpha = 0.9 * f.dim(star) * f.born(star);
      ctx.fillText(`BASE #${mark.landed.number} MERGED · UPDATE`, x - 4, y - 6);
    }
    ctx.restore();
  }

  private isShown(f: SkyFrame): boolean {
    return f.chart === 'prs' && !this.paused;
  }

  private drawChain(
    c: CanvasRenderingContext2D,
    f: SkyFrame,
    child: SkyStar,
    parent: SkyStar,
  ): void {
    const [cx, cy] = f.toScreen(child.ax, child.ay, child.az);
    const [px, py] = f.toScreen(parent.ax, parent.ay, parent.az);
    const length = Math.hypot(px - cx, py - cy) || 1;
    const ux = (px - cx) / length;
    const uy = (py - cy) / length;
    const fromChild = starRadius(f, child, 1) + LINK_GAP;
    const fromParent = starRadius(f, parent, 1) + LINK_GAP;
    if (length <= fromChild + fromParent) return;
    const [x0, y0] = [cx + ux * fromChild, cy + uy * fromChild];
    const [x1, y1] = [px - ux * fromParent, py - uy * fromParent];
    const alpha =
      0.7 * Math.min(f.dim(child), f.dim(parent)) * Math.min(f.born(child), f.born(parent));
    if (alpha <= 0) return;
    const angle = Math.atan2(uy, ux);
    const links = chainLinks(x0, y0, x1, y1);
    c.globalAlpha = alpha;
    c.strokeStyle = INK;
    c.lineWidth = 1.3;
    for (const link of links) drawLink(c, link, angle);
    if (!f.frozen && links.length) {
      const u = (f.t * GLINT_SPEED) % 1;
      drawGlint(c, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, alpha);
    }
  }

  private drawStub(c: CanvasRenderingContext2D, f: SkyFrame, star: SkyStar): void {
    const [x, y] = f.toScreen(star.ax, star.ay, star.az);
    const from = starRadius(f, star, 1) + LINK_GAP;
    const [x0, y0] = [x + Math.cos(STUB_ANGLE) * from, y + Math.sin(STUB_ANGLE) * from];
    const [x1, y1] = this.stubEnd(f, star);
    c.globalAlpha = 0.85 * f.dim(star) * f.born(star);
    c.strokeStyle = LANDED_INK;
    c.lineWidth = 1.3;
    const links = chainLinks(x0, y0, x1, y1);
    links.forEach((link, i) =>
      i === links.length - 1 ? drawBrokenLink(c, link, STUB_ANGLE) : drawLink(c, link, STUB_ANGLE),
    );
  }

  private stubEnd(f: SkyFrame, star: SkyStar): [number, number] {
    const [x, y] = f.toScreen(star.ax, star.ay, star.az);
    const reach = starRadius(f, star, 1) + LINK_GAP + LINK_STEP * (STUB_LINKS + 0.5);
    return [x + Math.cos(STUB_ANGLE) * reach, y + Math.sin(STUB_ANGLE) * reach];
  }
}

function drawLink(c: CanvasRenderingContext2D, link: ChainLink, angle: number): void {
  c.beginPath();
  if (link.isFaceOn) {
    c.ellipse(link.x, link.y, LINK_HALF_LENGTH, LINK_HALF_WIDTH, angle, 0, Math.PI * 2);
  } else {
    const dx = Math.cos(angle) * LINK_HALF_LENGTH;
    const dy = Math.sin(angle) * LINK_HALF_LENGTH;
    c.moveTo(link.x - dx, link.y - dy);
    c.lineTo(link.x + dx, link.y + dy);
  }
  c.stroke();
}

/** The last link of a broken chain: open at its far end. */
function drawBrokenLink(c: CanvasRenderingContext2D, link: ChainLink, angle: number): void {
  const gap = 0.9;
  c.beginPath();
  c.ellipse(link.x, link.y, LINK_HALF_LENGTH, LINK_HALF_WIDTH, angle, gap, Math.PI * 2 - gap);
  c.stroke();
}

function drawGlint(c: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
  const glow = c.createRadialGradient(x, y, 0, x, y, GLINT_REACH);
  glow.addColorStop(0, 'rgba(240, 246, 255, 0.9)');
  glow.addColorStop(1, 'rgba(201, 211, 234, 0)');
  c.globalAlpha = alpha;
  c.fillStyle = glow;
  c.beginPath();
  c.arc(x, y, GLINT_REACH, 0, Math.PI * 2);
  c.fill();
}
