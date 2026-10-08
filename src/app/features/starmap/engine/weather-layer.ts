import { PullWeather, WeatherByPull, flagWeight } from '../../../core/queue/weather';
import { starRadius } from './canvas-sky';
import { rnd } from './rnd';
import { SkyFrame, SkyLayer } from './sky-frame';
import { SkyStar } from './sky-model';

/** How a pull request's red flags read on the sky: a haze for a few light ones, a storm for many or grave ones. */
export type StormLevel = 'haze' | 'squall' | 'storm';

export interface Storm {
  readonly level: StormLevel;
  /** 0 to 1: how much of a full storm it is. */
  readonly strength: number;
  /** How far the weather reaches, in star radii. */
  readonly reach: number;
  /** Specks of debris caught in it. */
  readonly debris: number;
}

/** The weight at which weather is a full storm: four discarded errors, or a dozen stray TODOs. */
export const FULL_STORM_WEIGHT = 12;
const SQUALL_FROM = 1 / 3;
const STORM_FROM = 2 / 3;
/** It starts just past the planets' inner orbit (1.9 radii) and grows past the outermost (3.7). */
const MIN_REACH = 2.2;
const REACH_GROWTH = 2.6;
const DEBRIS_PER_WEIGHT = 2;
const MAX_DEBRIS = 28;

/** The weather a pull request's flags make, or null for none: clear, or not scanned. */
export function stormOf(weather: PullWeather | undefined): Storm | null {
  const weight = flagWeight(weather);
  if (weight <= 0) return null;
  const strength = Math.min(1, weight / FULL_STORM_WEIGHT);
  const level: StormLevel =
    strength >= STORM_FROM ? 'storm' : strength >= SQUALL_FROM ? 'squall' : 'haze';
  return {
    level,
    strength,
    reach: MIN_REACH + REACH_GROWTH * strength,
    debris: Math.min(MAX_DEBRIS, weight * DEBRIS_PER_WEIGHT),
  };
}

/** Screen-pixel bounds, so a far-off star's weather still shows and a near one's never fills the view. */
const MIN_REACH_PX = 14;
const MAX_REACH_PX = 130;
/** The eye stays clear of the star itself. */
const EYE_REACH = 1.6;
const EYE_SHARE = 0.45;
const BANDS: Readonly<Record<StormLevel, number>> = { haze: 1, squall: 2, storm: 3 };
/** Radians a second; inner debris turns faster, as round a storm's eye. */
const SPIN = 0.35;
const TILT = 0.55;
const CLOUD = '138, 147, 184';
const DEBRIS = '217, 199, 160';
const LIGHTNING = '#e6e0ff';
/** A storm flashes once in this many seconds, for this long. */
const FLASH_EVERY = 3.2;
const FLASH_FOR = 0.12;

/** One storm as it is drawn this frame, in screen pixels about its star. */
interface Swirl {
  readonly pr: number;
  readonly storm: Storm;
  readonly x: number;
  readonly y: number;
  /** The eye's edge and the outer edge. */
  readonly inner: number;
  readonly reach: number;
  readonly turn: number;
  readonly alpha: number;
}

/**
 * Tactical weather: a swirl of cloud and debris round each pull request whose
 * added lines carry design red flags, growing with how many and how grave.
 * Drawn flat over both renderers in screen pixels; it turns with the scene's
 * time, so it holds still, without lightning, when motion is off. A clear or
 * unscanned pull request has none.
 */
export class WeatherLayer implements SkyLayer {
  private storms = new Map<number, Storm>();
  /** Replay shows the queue as it was; the weather is read from the code as it is. */
  paused = false;

  set(weather: WeatherByPull): void {
    this.storms = new Map();
    for (const [pr, pull] of weather) {
      const storm = stormOf(pull);
      if (storm) this.storms.set(pr, storm);
    }
  }

  flat(c: CanvasRenderingContext2D, f: SkyFrame): void {
    if (f.chart !== 'prs' || this.paused || !this.storms.size) return;
    c.save();
    c.lineCap = 'round';
    for (const star of f.stars) {
      const pr = star.item?.pr ?? -1;
      const storm = this.storms.get(pr);
      const swirl = storm && swirlOf(f, star, pr, storm);
      if (swirl) drawSwirl(c, f, swirl);
    }
    c.restore();
  }
}

/** Where and how large a storm is this frame; null when it is off screen or its star is not lit. */
function swirlOf(f: SkyFrame, star: SkyStar, pr: number, storm: Storm): Swirl | null {
  const alpha = f.dim(star) * f.born(star);
  const [x, y] = f.toScreen(star.ax, star.ay, star.az);
  const isOff =
    x < -MAX_REACH_PX ||
    y < -MAX_REACH_PX ||
    x > f.width + MAX_REACH_PX ||
    y > f.height + MAX_REACH_PX;
  if (alpha <= 0 || isOff) return null;
  const core = starRadius(f, star, 1);
  const reach = Math.min(Math.max(core * storm.reach, MIN_REACH_PX), MAX_REACH_PX);
  const inner = Math.max(core * EYE_REACH, reach * EYE_SHARE);
  return { pr, storm, x, y, inner, reach, turn: f.t * SPIN, alpha };
}

function drawSwirl(c: CanvasRenderingContext2D, f: SkyFrame, swirl: Swirl): void {
  c.save();
  c.translate(swirl.x, swirl.y);
  drawClouds(c, swirl);
  drawDebris(c, swirl);
  if (swirl.storm.level === 'storm' && !f.frozen) drawLightning(c, swirl, f.t);
  c.restore();
}

/** Arms of cloud, each a broad faint stroke round the eye, one more for each level. */
function drawClouds(c: CanvasRenderingContext2D, swirl: Swirl): void {
  const { storm, inner, reach, turn, alpha } = swirl;
  const bands = BANDS[storm.level];
  c.strokeStyle = `rgba(${CLOUD}, ${(0.18 + 0.32 * storm.strength) * alpha})`;
  c.lineWidth = 2 + 4 * storm.strength;
  for (let band = 0; band < bands; band++) {
    const start = turn * (1 + band * 0.4) + (band * Math.PI * 2) / bands;
    const radius = inner + ((reach - inner) * (band + 1)) / (bands + 1);
    c.beginPath();
    c.ellipse(0, 0, radius, radius * TILT, 0, start, start + Math.PI * (0.9 + storm.strength));
    c.stroke();
  }
}

/** Specks on tilted orbits through the cloud, placed by the pull request's number so they stay put. */
function drawDebris(c: CanvasRenderingContext2D, swirl: Swirl): void {
  const { pr, storm, inner, reach, turn, alpha } = swirl;
  const random = rnd(pr);
  c.fillStyle = `rgba(${DEBRIS}, ${0.75 * alpha})`;
  for (let n = 0; n < storm.debris; n++) {
    const along = random();
    const radius = inner + (reach - inner) * along;
    const angle = random() * Math.PI * 2 + turn * (1.8 - along);
    const size = 0.8 + random() * 1.4;
    c.beginPath();
    c.arc(Math.cos(angle) * radius, Math.sin(angle) * radius * TILT, size, 0, Math.PI * 2);
    c.fill();
  }
}

/** A jagged fork through the cloud, flashing briefly on the storm's own beat. */
function drawLightning(c: CanvasRenderingContext2D, swirl: Swirl, t: number): void {
  const { pr, reach, alpha } = swirl;
  const beat = t + (pr % 7) * 0.45;
  const cycle = Math.floor(beat / FLASH_EVERY);
  if (beat - cycle * FLASH_EVERY > FLASH_FOR) return;
  const random = rnd(pr * 31 + cycle);
  const angle = random() * Math.PI * 2;
  c.strokeStyle = LIGHTNING;
  c.globalAlpha = 0.85 * alpha;
  c.lineWidth = 1.2;
  c.beginPath();
  let [px, py] = [Math.cos(angle) * reach * 0.5, Math.sin(angle) * reach * 0.5 * TILT];
  c.moveTo(px, py);
  for (let step = 0; step < 4; step++) {
    px += Math.cos(angle) * reach * 0.14 + (random() - 0.5) * reach * 0.2;
    py += Math.sin(angle) * reach * 0.14 * TILT + (random() - 0.5) * reach * 0.12;
    c.lineTo(px, py);
  }
  c.stroke();
}
