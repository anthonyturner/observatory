import { rnd } from '../engine/rnd';
import { NurseryBody } from './nursery-layout';

/* What the nursery draws round a body: jets, moons, dust, and the words on
   hover. Canvas inks, pr-starmap's own. */

const JET_COLOUR = '#dfe8ff';
/** Two or more pull requests on one issue: the binary-star warning. */
const TWIN_JET_COLOUR = '#ffc24d';
const MOON_COLOUR = '#cfd8ff';
const DUST_COLOUR = '#8d9bc4';
const LABEL_NUMBER = '#eaf0ff';
const LABEL_TITLE = '#b8c4e6';
const MAX_MOONS = 4;
const DUST_GRAINS = 7;
const TITLE_MAX = 52;

/** One body on screen, this frame. */
export interface Mark {
  readonly c: CanvasRenderingContext2D;
  readonly x: number;
  readonly y: number;
  /** Radius and alpha, after arrival, filter and fade. */
  readonly r: number;
  readonly a: number;
  readonly t: number;
  readonly frozen: boolean;
}

/** One bipolar jet per open pull request on the issue, named on hover. */
export function drawJets(m: Mark, body: NurseryBody, spin: number, named: boolean): void {
  const { c, x, y, r, a } = m;
  const prs = body.jets;
  const colour = prs.length > 1 ? TWIN_JET_COLOUR : JET_COLOUR;
  const len = r * 5.2;
  const flick = m.frozen ? 1 : 0.8 + Math.sin(m.t * 3 + spin) * 0.2;
  prs.forEach((n, k) => {
    const ang = body.jetAngle + (k * Math.PI) / prs.length;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    for (const sign of [1, -1]) {
      const g = c.createLinearGradient(x, y, x + dx * sign, y + dy * sign);
      g.addColorStop(0, colour);
      g.addColorStop(1, `${colour}00`);
      c.globalAlpha = a * 0.85 * flick;
      c.strokeStyle = g;
      c.lineWidth = Math.max(1, r * 0.22);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + dx * sign, y + dy * sign);
      c.stroke();
    }
    if (named) {
      c.save();
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = a;
      c.fillStyle = colour;
      c.font = '500 10px "IBM Plex Mono", monospace';
      c.textAlign = 'center';
      c.fillText(`#${n}`, x + dx * 1.12, y + dy * 1.12 + 3);
      c.restore();
    }
  });
}

/** Each assignee is a small moon, so owned work is visible at a glance. */
export function drawMoons(m: Mark, assignees: number, spin: number): void {
  const { c, x, y, r, a } = m;
  const n = Math.min(assignees, MAX_MOONS);
  const orbit = r * 2 + 6;
  for (let k = 0; k < n; k++) {
    const ang = (m.frozen ? 0 : m.t * 0.8) + spin + (k * Math.PI * 2) / n;
    c.globalAlpha = a * 0.95;
    c.fillStyle = MOON_COLOUR;
    c.beginPath();
    c.arc(
      x + Math.cos(ang) * orbit,
      y + Math.sin(ang) * orbit * 0.6,
      Math.max(1.6, r * 0.18),
      0,
      Math.PI * 2,
    );
    c.fill();
  }
}

/** Closed as not planned: a scatter of faint dust where a star never lit. */
export function drawDust(m: Mark, issueNumber: number): void {
  const { c, x, y, r, a } = m;
  const rr = rnd(issueNumber * 97 + 5);
  c.fillStyle = DUST_COLOUR;
  for (let k = 0; k < DUST_GRAINS; k++) {
    c.globalAlpha = a * (0.18 + rr() * 0.25);
    c.beginPath();
    c.arc(x + (rr() - 0.5) * r * 4, y + (rr() - 0.5) * r * 2.2, 0.6 + rr() * 1.3, 0, Math.PI * 2);
    c.fill();
  }
}

/** The number and title under a body: on hover and selection only, since a
 *  thousand captions at once is a smear. */
export function drawIssueLabel(
  ctx: CanvasRenderingContext2D,
  at: { readonly x: number; readonly y: number; readonly r: number },
  body: NurseryBody,
): void {
  const { number, title } = body.issue;
  const words = title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 2)}…` : title;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = LABEL_NUMBER;
  ctx.font = '500 11px "IBM Plex Mono", monospace';
  ctx.fillText(`#${number}`, at.x, at.y + at.r * 2 + 16);
  ctx.fillStyle = LABEL_TITLE;
  ctx.font = '400 12px "IBM Plex Sans", sans-serif';
  ctx.fillText(words, at.x, at.y + at.r * 2 + 31);
  ctx.restore();
}
