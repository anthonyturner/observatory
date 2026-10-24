import { Color } from 'three';
import { STAR_QUAD_REACH, STAR_TYPES } from '../../../shared/gl/star-shader';
import { InstanceBatch } from './instance-batch';
import { SkyFrame } from './sky-frame';
import { SkyStar } from './sky-model';
import { IssuePlanet, Mass, PLANET_TONES, issuePlanets, massOf, systemTurn } from './star-system';
import { DISC_QUAD_MARGIN, SYSTEM_TILT } from './star-system-shaders';
import { starLook } from './star-type';

/* What the 3D sky draws for its pull-request stars, as per-instance values:
   one batch each for the stars, their discs of gas, their planets and the
   rings an urgent star pulses. The scene draws each batch in one call. */

/* A star's drawn disc, as a share of starRadius. Far off it is the old small
   core; close up it grows into the gap the links leave, so the surface shows,
   without changing starRadius itself, which the link gaps are measured from. */
const FAR_DISC = 0.46;
const NEAR_DISC = 0.75;
/** The on-screen core radius, in pixels, over which surface detail fades in. */
const FAR_CORE_PX = 2.5;
const NEAR_CORE_PX = 8;

/** A planet is never smaller than this many screen pixels across. */
const MIN_PLANET_PX = 1.2;
/** Planets show once a star has this much surface detail. */
const PLANET_DETAIL = 0.02;
/** The disc of gas starts this far out from the star's drawn disc. */
const DISC_CLEARANCE = 1.3;

const smoothstep = (from: number, to: number, x: number): number => {
  const k = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return k * k * (3 - 2 * k);
};

/* The attribute names are the ones the shaders read. */
const bodyBatch = (count: number) =>
  new InstanceBatch(count, { aPos: 3, aSize: 1, aInk: 3, aKind: 3, aState: 3 }, [
    'aPos',
    'aSize',
    'aState',
  ]);
const discBatch = (count: number) =>
  new InstanceBatch(count, { aPos: 3, aSize: 1, aInk: 3, aKind: 2, aSpin: 3, aFade: 2 }, [
    'aPos',
    'aSize',
    'aSpin',
    'aFade',
  ]);
const planetBatch = (count: number) =>
  new InstanceBatch(count, { aPos: 3, aSize: 1, aTone: 3, aStar: 3, aOpacity: 1 }, [
    'aPos',
    'aSize',
    'aStar',
    'aOpacity',
  ]);
const pulseBatch = (count: number) =>
  new InstanceBatch(count, { aPos: 3, aSize: 1, aInk: 3, aAlpha: 1 }, ['aPos', 'aSize', 'aAlpha']);

/** One star and where its marks sit in each batch; -1 for a mark it has none of. */
interface Member {
  readonly star: SkyStar;
  readonly mass: Mass | null;
  readonly worlds: readonly IssuePlanet[];
  readonly disc: number;
  readonly firstPlanet: number;
  readonly pulse: number;
}

export class SkyInstances {
  readonly bodies = bodyBatch(0);
  readonly discs = discBatch(0);
  readonly planets = planetBatch(0);
  readonly pulses = pulseBatch(0);
  private members: readonly Member[] = [];

  constructor(stars: readonly SkyStar[] = []) {
    this.load(stars);
  }

  /** Lays the batches out for these stars and writes the values that never
   *  change; `update` writes the rest each frame. The batches are the same
   *  objects as before, resized, so a layout costs no new buffers while it fits. */
  load(stars: readonly SkyStar[]): void {
    let discs = 0;
    let planets = 0;
    let pulses = 0;
    // A custom star is drawn by its own sky, not as a body.
    this.members = stars
      .filter((star) => !star.custom)
      .map((star) => {
        const mass = massOf(star);
        const worlds = issuePlanets(star);
        const member: Member = {
          star,
          mass,
          worlds,
          disc: mass ? discs++ : -1,
          firstPlanet: planets,
          pulse: star.urgent ? pulses++ : -1,
        };
        planets += worlds.length;
        return member;
      });
    this.bodies.resize(this.members.length);
    this.discs.resize(discs);
    this.planets.resize(planets);
    this.pulses.resize(pulses);

    const tones = PLANET_TONES.map((hex) => new Color(hex));
    const ink = new Color();
    this.members.forEach(({ star, mass, worlds, disc, firstPlanet, pulse }, i) => {
      const look = starLook(star);
      this.bodies.colour('aInk', i, ink.set(star.colour));
      this.bodies.set(
        'aKind',
        i,
        STAR_TYPES.indexOf(look.type),
        look.activity,
        (star.spin * 97) % 61,
      );
      if (mass) {
        this.discs.colour('aInk', disc, ink.set(mass.colour));
        this.discs.set('aKind', disc, mass.weight, (star.spin * 53) % 41);
      }
      worlds.forEach((world, j) =>
        this.planets.colour('aTone', firstPlanet + j, tones[world.tone]),
      );
      if (pulse >= 0) this.pulses.colour('aInk', pulse, ink.set(star.colour));
    });
  }

  /** Writes this frame's place, size, detail and fade of every mark. A mark that
   *  should not show is sized and faded to nothing, so the draw skips it. */
  update(f: SkyFrame, depthAt: (z: number) => number): void {
    const { t, frozen } = f;
    const { scale } = f.camera.current;
    this.members.forEach(({ star, mass, worlds, disc, firstPlanet, pulse }, i) => {
      const grow = f.born(star);
      const dim = f.dim(star);
      const tw =
        0.78 +
        Math.sin(t * star.twinkleRate + star.twinkle) * 0.16 +
        Math.sin(t * star.twinkleRate * 2.7 + star.twinkle * 1.7) * 0.07;
      const r = star.mag * Math.max(scale, 0.42) * grow;
      // Magnitude is data: cancel perspective shrinkage at each sprite's depth.
      const unit = 1 / (scale * depthAt(star.az));
      const detail = smoothstep(FAR_CORE_PX, NEAR_CORE_PX, r * FAR_DISC);
      const drawn = FAR_DISC + (NEAR_DISC - FAR_DISC) * detail;
      const { ax, ay, az } = star;

      this.bodies.point('aPos', i, ax, ay, az);
      this.bodies.set('aSize', i, r * STAR_QUAD_REACH * 2 * unit);
      this.bodies.set('aState', i, detail, drawn, dim * grow * (0.7 + tw * 0.3));

      const turn = systemTurn(star.spin, t, frozen);
      if (mass) {
        const shown = f.chart === 'prs' && grow > 0;
        const reach = Math.max(mass.reach * r, 0.001);
        this.discs.point('aPos', disc, ax, ay, az);
        this.discs.set('aSize', disc, shown ? mass.reach * r * DISC_QUAD_MARGIN * 2 * unit : 0);
        this.discs.set(
          'aSpin',
          disc,
          turn,
          (drawn * DISC_CLEARANCE * r) / reach,
          (drawn * r) / reach,
        );
        this.discs.set('aFade', disc, detail, shown ? dim * grow : 0);
      }

      worlds.forEach((planet, j) => {
        // Each issue's world, in the disc's tilted plane, turned as the disc turns.
        const angle = planet.phase + (frozen ? 0 : t * planet.speed);
        const ox = Math.cos(angle) * planet.orbit * r;
        const oy = Math.sin(angle) * planet.orbit * r * SYSTEM_TILT;
        const sx = ox * Math.cos(turn) - oy * Math.sin(turn);
        const sy = ox * Math.sin(turn) + oy * Math.cos(turn);
        const shown = detail > PLANET_DETAIL && grow > 0;
        const at = firstPlanet + j;
        this.planets.point(
          'aPos',
          at,
          ax + sx * unit,
          ay + sy * unit,
          az + Math.sin(angle) * planet.orbit * r * unit,
        );
        this.planets.set(
          'aSize',
          at,
          shown ? Math.max(planet.size * r, MIN_PLANET_PX / 2) * unit : 0,
        );
        this.planets.point('aStar', at, ax, ay, az);
        this.planets.set('aOpacity', at, shown ? dim * grow * detail : 0);
      });

      if (pulse >= 0) {
        const phase = (t * 0.42 + star.spin) % 1;
        this.pulses.point('aPos', pulse, ax, ay, az);
        this.pulses.set('aSize', pulse, frozen ? 0 : r * (1.4 + phase * 4.2) * unit);
        this.pulses.set('aAlpha', pulse, frozen ? 0 : dim * grow * (1 - phase) * 0.34);
      }
    });
  }
}
