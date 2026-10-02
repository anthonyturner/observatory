import { MapEntry, Neighbour, Neighbourhood } from './architecture-graph';
import { ArchitectureArea } from './architecture.types';

/** A member the planet reads from the sun, drawn as a moon round the planet. */
export interface Moon {
  readonly member: string;
  readonly x: number;
  readonly y: number;
}

export interface Planet {
  readonly entry: MapEntry;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly moons: readonly Moon[];
  /** Members beyond the moons drawn. */
  readonly hiddenMoons: number;
}

/** `uses` holds what the sun injects; `area` holds what injects the sun, one area per band. */
export type OrbitKind = 'uses' | 'area';

export interface Orbit {
  readonly key: string;
  readonly kind: OrbitKind;
  /** Named on the first ring of a band only; '' on the rings a full band spills onto. */
  readonly label: string;
  readonly radius: number;
  /** Seconds for one turn; outer rings turn slower, as planets do. */
  readonly period: number;
  readonly planets: readonly Planet[];
}

export interface StarSystem {
  readonly sun: MapEntry;
  readonly orbits: readonly Orbit[];
  readonly viewBox: string;
}

interface Band {
  readonly key: string;
  readonly kind: OrbitKind;
  readonly label: string;
  readonly neighbours: readonly Neighbour[];
}

export const SUN_RADIUS = 34;
export const USES_LABEL = 'Injects';
const FIRST_ORBIT = 130;
const ORBIT_GAP = 78;
/** Room along a ring for one planet and its name. */
const PLANET_ARC = 150;
const MARGIN = 110;
const MIN_PLANET = 7;
const MAX_PLANET = 18;
const PLANET_GROWTH = 2.4;
const MOON_GAP = 8;
const MAX_MOONS = 8;
const INNER_PERIOD_S = 120;
const PERIOD_STEP_S = 40;
/** Each ring starts a little further round, so names on neighbouring rings do not stack. */
const RING_OFFSET_RAD = 0.5;
const FULL_TURN = Math.PI * 2;

const radiusOf = (ring: number): number => FIRST_ORBIT + ring * ORBIT_GAP;
const capacityOf = (radius: number): number =>
  Math.max(1, Math.floor((FULL_TURN * radius) / PLANET_ARC));
const sizeOf = (entry: MapEntry): number =>
  Math.min(MAX_PLANET, MIN_PLANET + PLANET_GROWTH * Math.sqrt(entry.dependents));
const round = (value: number): number => Math.round(value * 10) / 10;

function moonsOf(members: readonly string[], size: number): Moon[] {
  const shown = members.slice(0, MAX_MOONS);
  return shown.map((member, index) => {
    const angle = (FULL_TURN * index) / shown.length;
    const reach = size + MOON_GAP;
    return { member, x: round(reach * Math.cos(angle)), y: round(reach * Math.sin(angle)) };
  });
}

function planetsOn(ring: number, neighbours: readonly Neighbour[]): Planet[] {
  const radius = radiusOf(ring);
  return neighbours.map(({ entry, members }, index) => {
    const angle = ring * RING_OFFSET_RAD + (FULL_TURN * index) / neighbours.length;
    const size = round(sizeOf(entry));
    return {
      entry,
      x: round(radius * Math.cos(angle)),
      y: round(radius * Math.sin(angle)),
      size,
      moons: moonsOf(members, size),
      hiddenMoons: Math.max(0, members.length - MAX_MOONS),
    };
  });
}

function bandsOf(neighbourhood: Neighbourhood, areas: readonly ArchitectureArea[]): Band[] {
  const uses: Band = {
    key: 'uses',
    kind: 'uses',
    label: USES_LABEL,
    neighbours: neighbourhood.dependencies,
  };
  const byArea = areas.map(({ id, label }): Band => ({
    key: `area:${id}`,
    kind: 'area',
    label,
    neighbours: neighbourhood.dependents.filter(({ entry }) => entry.node.area === id),
  }));
  return [uses, ...byArea].filter((band) => band.neighbours.length > 0);
}

/** A band's rings, starting at ring `first`: as many as its planets need at that distance. */
function orbitsOf(band: Band, first: number): Orbit[] {
  const orbits: Orbit[] = [];
  let placed = 0;
  while (placed < band.neighbours.length) {
    const ring = first + orbits.length;
    const group = band.neighbours.slice(placed, placed + capacityOf(radiusOf(ring)));
    orbits.push({
      key: `${band.key}:${orbits.length}`,
      kind: band.kind,
      label: orbits.length === 0 ? band.label : '',
      radius: radiusOf(ring),
      period: INNER_PERIOD_S + ring * PERIOD_STEP_S,
      planets: planetsOn(ring, group),
    });
    placed += group.length;
  }
  return orbits;
}

/** The centre as a sun: what it injects on the innermost ring, then its dependents by area. */
export function starSystem(
  neighbourhood: Neighbourhood,
  areas: readonly ArchitectureArea[],
): StarSystem {
  const orbits = bandsOf(neighbourhood, areas).reduce<Orbit[]>(
    (placed, band) => [...placed, ...orbitsOf(band, placed.length)],
    [],
  );
  const extent = (orbits.at(-1)?.radius ?? SUN_RADIUS) + MARGIN;
  return {
    sun: neighbourhood.centre,
    orbits,
    viewBox: `${-extent} ${-extent} ${extent * 2} ${extent * 2}`,
  };
}
