import { DepthModule } from './depth.types';
import { packCircles } from './pack-circles';

/** Pixels across per square root of a statement: area follows the work a module hides. */
const CORE_PER_ROOT = 1.1;
/** Pixels of ring width per square root of a thing a caller must learn. */
const SHELL_PER_ROOT = 1.4;
/** A module with no work, or no interface, still shows as a speck and a thread. */
const SMALLEST_CORE = 1.5;
const SMALLEST_SHELL_WIDTH = 2;
const PLANET_GAP = 3;
const SYSTEM_PADDING = 10;
const SYSTEM_GAP = 16;
const CHART_MARGIN = 24;
const ROOT_NAME = 'root';

/** One module drawn as a planet: a core for the work it hides, inside a shell for its interface. */
export interface Planet {
  readonly module: DepthModule;
  readonly x: number;
  readonly y: number;
  readonly core: number;
  /** The outer radius, core and ring width together. */
  readonly shell: number;
}

/** One folder's modules, drawn together in a faint disc. */
export interface PlanetarySystem {
  readonly folder: string;
  /** The folder's own name, for the label on its disc. */
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly planets: readonly Planet[];
}

export interface ChartBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DepthChart {
  readonly systems: readonly PlanetarySystem[];
  /** Every planet, folder by folder in path order and largest first within one: the order the keyboard walks. */
  readonly planets: readonly Planet[];
  readonly box: ChartBox;
}

export function coreRadius(implementation: number): number {
  return Math.max(SMALLEST_CORE, CORE_PER_ROOT * Math.sqrt(implementation));
}

/** A deep module's shell hugs its core; a shallow one stands well clear of a small core. */
export function shellRadius({ implementation, interfaceSize }: DepthModule): number {
  const width = Math.max(SMALLEST_SHELL_WIDTH, SHELL_PER_ROOT * Math.sqrt(interfaceSize));
  return coreRadius(implementation) + width;
}

const byShellThenFile = (a: Planet, b: Planet): number =>
  b.shell - a.shell || a.module.file.localeCompare(b.module.file);

const unplaced = (module: DepthModule): Planet => ({
  module,
  x: 0,
  y: 0,
  core: coreRadius(module.implementation),
  shell: shellRadius(module),
});

/** One folder's planets packed round each other, then centred on the disc that holds them. */
function systemAround(folder: string, modules: readonly DepthModule[]): PlanetarySystem {
  const sorted = modules.map(unplaced).sort(byShellThenFile);
  const spots = packCircles(
    sorted.map(({ shell }) => shell),
    PLANET_GAP,
  );
  const packed = sorted.map((planet, i) => ({ ...planet, ...spots[i] }));
  const left = Math.min(...packed.map(({ x, shell }) => x - shell));
  const right = Math.max(...packed.map(({ x, shell }) => x + shell));
  const top = Math.min(...packed.map(({ y, shell }) => y - shell));
  const bottom = Math.max(...packed.map(({ y, shell }) => y + shell));
  const [centreX, centreY] = [(left + right) / 2, (top + bottom) / 2];
  const planets = packed.map((planet) => ({
    ...planet,
    x: planet.x - centreX,
    y: planet.y - centreY,
  }));
  const reach = Math.max(...planets.map(({ x, y, shell }) => Math.hypot(x, y) + shell));
  return {
    folder,
    name: folder.split('/').pop() || ROOT_NAME,
    x: 0,
    y: 0,
    r: reach + SYSTEM_PADDING,
    planets,
  };
}

function groupByFolder(modules: readonly DepthModule[]): [string, DepthModule[]][] {
  const groups = new Map<string, DepthModule[]>();
  for (const module of modules) {
    const inside = groups.get(module.folder) ?? [];
    inside.push(module);
    groups.set(module.folder, inside);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}

function boxAround(systems: readonly PlanetarySystem[]): ChartBox {
  const left = Math.min(...systems.map(({ x, r }) => x - r)) - CHART_MARGIN;
  const right = Math.max(...systems.map(({ x, r }) => x + r)) + CHART_MARGIN;
  const top = Math.min(...systems.map(({ y, r }) => y - r)) - CHART_MARGIN;
  const bottom = Math.max(...systems.map(({ y, r }) => y + r)) + CHART_MARGIN;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The modules as a sky: each folder a disc, each module in it a planet sized
 * by its work and ringed by its interface, the discs packed round the largest.
 * No modules is an empty chart.
 */
export function depthChart(modules: readonly DepthModule[]): DepthChart {
  if (!modules.length)
    return { systems: [], planets: [], box: { x: 0, y: 0, width: 0, height: 0 } };
  const loose = groupByFolder(modules).map(([folder, inside]) => systemAround(folder, inside));
  const spots = packCircles(
    loose.map(({ r }) => r),
    SYSTEM_GAP,
  );
  const systems = loose.map((system, i): PlanetarySystem => {
    const { x, y } = spots[i];
    return {
      ...system,
      x,
      y,
      planets: system.planets.map((planet) => ({ ...planet, x: planet.x + x, y: planet.y + y })),
    };
  });
  return { systems, planets: systems.flatMap(({ planets }) => planets), box: boxAround(systems) };
}
