import { SkyFrame, SkyLayer } from '../engine/sky-frame';
import { SkyStar, WORLD } from '../engine/sky-model';
import { COMET_COLOUR, SETTLED_COLOUR } from '../../issues/issue-inks';
import { Nursery, NurseryArm, NURSERY, armTheta, bodyOf, polar } from './nursery-layout';
import { Mark, drawDust, drawIssueLabel, drawJets, drawMoons } from './nursery-marks';
import { NurserySprites } from './nursery-sprites';

const CORE_INKS = [
  'rgba(255, 226, 170, 0.55)',
  'rgba(255, 190, 120, 0.18)',
  'rgba(255, 190, 120, 0)',
];
/** A broad faint band and a thin spine read as a gas lane, not a wire. */
const LANE: readonly (readonly [number, number])[] = [
  [34, 0.05],
  [10, 0.1],
  [1.4, 0.32],
];
const ARM_STEPS = 48;
const LIT_ARM = 2.4;
const QUIET_ARM = 0.35;
const OFFSCREEN = 120;

/**
 * pr-starmap's nursery on the sky: it turns the disk rigidly, arms and bodies
 * together, so nothing shears off its arm; it draws the arms, the warm core
 * and every body in the flat layer both renderers share; and it names the
 * body under the pointer and the selected one.
 */
export class NurseryLayer implements SkyLayer {
  private nursery: Nursery | null = null;
  private readonly sprites: NurserySprites;
  /** The body under the pointer. */
  hovered: SkyStar | null = null;
  /** The label the bar has chosen, which lights its arm. */
  litLabel = '';

  constructor(document: Document) {
    this.sprites = new NurserySprites(document);
  }

  /** The disk laid out for the sky on screen, or none on another sky. */
  setNursery(nursery: Nursery | null): void {
    this.nursery = nursery;
    this.hovered = null;
  }

  move(t: number, frozen: boolean): void {
    const nursery = this.nursery;
    if (!nursery) return;
    const a = frozen ? 0 : t * NURSERY.spin;
    for (const cluster of [...nursery.arms.map((arm) => arm.cluster), nursery.halo]) {
      for (const star of cluster.stars) {
        const body = bodyOf(star);
        if (body) [star.x, star.y] = polar(body.theta0 + a, body.rad);
      }
    }
    const rad = NURSERY.r1 * 1.1;
    for (const { cluster, base } of nursery.arms) {
      [cluster.cx, cluster.labelY] = polar(armTheta(base, rad) + a, rad);
    }
  }

  flat(c: CanvasRenderingContext2D, f: SkyFrame): void {
    const nursery = this.nursery;
    if (!nursery || f.chart !== 'issues') return;
    this.drawArms(c, f, nursery.arms);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const star of f.stars) this.drawBody(c, f, star);
    c.restore();
  }

  labels(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
    if (!this.nursery || f.chart !== 'issues') return;
    for (const star of new Set([this.hovered, f.selected])) {
      const body = bodyOf(star);
      if (!star || !body) continue;
      const [x, y] = f.toScreen(star.ax, star.ay, star.az);
      drawIssueLabel(ctx, { x, y, r: star.mag * Math.max(f.camera.current.scale, 0.42) }, body);
    }
  }

  private drawArms(c: CanvasRenderingContext2D, f: SkyFrame, arms: readonly NurseryArm[]): void {
    const a = f.frozen ? 0 : f.t * NURSERY.spin;
    const scale = f.camera.current.scale;
    const [cx, cy] = f.toScreen(WORLD.w / 2, WORLD.h / 2);
    // The warm core the work falls toward.
    const coreR = NURSERY.r0 * 0.9 * scale;
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    core.addColorStop(0, CORE_INKS[0]);
    core.addColorStop(0.35, CORE_INKS[1]);
    core.addColorStop(1, CORE_INKS[2]);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = core;
    c.beginPath();
    c.ellipse(cx, cy, coreR, coreR * NURSERY.tilt, 0, 0, Math.PI * 2);
    c.fill();
    for (const { cluster, base } of arms) {
      if (!cluster.stars.length) continue;
      const lit = this.isLit(cluster.stars);
      const quiet = !!this.litLabel && !lit;
      c.strokeStyle = cluster.colour;
      c.lineCap = 'round';
      for (const [width, alpha] of LANE) {
        c.globalAlpha = alpha * (lit ? LIT_ARM : quiet ? QUIET_ARM : 1);
        c.lineWidth = Math.max(0.8, width * scale);
        c.beginPath();
        for (let k = 0; k <= ARM_STEPS; k++) {
          const rad = NURSERY.r0 * 0.7 + (NURSERY.r1 * 1.05 - NURSERY.r0 * 0.7) * (k / ARM_STEPS);
          const [x, y] = f.toScreen(...polar(armTheta(base, rad) + a, rad));
          if (k) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.stroke();
      }
    }
    c.restore();
  }

  /** An arm is lit when any of its issues carries the chosen label. */
  private isLit(stars: readonly SkyStar[]): boolean {
    const label = this.litLabel;
    return (
      !!label && stars.some((s) => bodyOf(s)?.issue.labels.some((l) => l.name === label) ?? false)
    );
  }

  private drawBody(c: CanvasRenderingContext2D, f: SkyFrame, star: SkyStar): void {
    const body = bodyOf(star);
    if (!body) return;
    const grow = f.born(star);
    if (grow <= 0) return;
    const [x, y] = f.toScreen(star.ax, star.ay, star.az);
    if (x < -OFFSCREEN || y < -OFFSCREEN || x > f.width + OFFSCREEN || y > f.height + OFFSCREEN) {
      return;
    }
    const r = star.mag * Math.max(f.camera.current.scale, 0.42) * grow;
    const mark: Mark = { c, x, y, r, a: f.dim(star) * grow * body.fade, t: f.t, frozen: f.frozen };
    if (body.look === 'dust') return drawDust(mark, body.issue.number);
    const globule = body.look === 'globule';
    const colour =
      body.look === 'settled'
        ? SETTLED_COLOUR
        : body.look === 'protostar'
          ? star.colour
          : COMET_COLOUR;
    const img = this.sprites.get(globule ? 'globule' : 'star', colour);
    const box = r * (globule ? 2.6 : 3.4);
    // A globule is dark gas; drawn additively its dark core would vanish.
    c.globalCompositeOperation = globule ? 'source-over' : 'lighter';
    c.globalAlpha = mark.a;
    c.drawImage(img, x - box, y - box, box * 2, box * 2);
    c.globalCompositeOperation = 'lighter';
    if (body.look === 'protostar') {
      drawJets(mark, body, star.spin, star === this.hovered || star === f.selected);
    }
    if (body.issue.assignees.length) drawMoons(mark, body.issue.assignees.length, star.spin);
  }
}
