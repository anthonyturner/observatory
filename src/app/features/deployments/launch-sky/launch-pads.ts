import {
  DeployEnvironment,
  DeployOutcome,
  Deployment,
} from '../../../core/deployments/deployments-report';
import { seededRandom } from '../../../core/instrument/seeded-random';
import { hashString } from '../../../core/orrery/world-layout';
import { Stage } from '../../releases/release-sky/release-path';

/** One environment's pad, along the foot of the stage. */
export interface PlacedPad {
  readonly key: string;
  readonly name: string;
  readonly isProduction: boolean;
  readonly x: number;
  readonly y: number;
  /** Half the pad's width; it is drawn as a flat ellipse. */
  readonly reach: number;
  readonly count: number;
  /** How its latest deployment went; null with none. */
  readonly latest: DeployOutcome | null;
}

/** One deployment's light: the latest on its beam above the pad, earlier ones up its trail. */
export interface PlacedDeployment {
  readonly key: string;
  readonly deployment: Deployment;
  /** 0 for an environment's latest, 1 for the one before, and so on. */
  readonly age: number;
  readonly padKey: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** How bright it is drawn, 0 to 1: older ones fade up the trail. */
  readonly alpha: number;
}

export interface PadLayout {
  readonly pads: readonly PlacedPad[];
  /** By environment, then newest first. */
  readonly deployments: readonly PlacedDeployment[];
}

/** No pad sits further than this from its neighbour, so two environments stay a pair. */
const MAX_COLUMN_PX = 320;
/** The pads stand this far down the stage. */
const PAD_DEPTH = 0.86;
const PAD_REACH_SHARE = 0.3;
const MAX_PAD_REACH_PX = 96;
/** A pad is a flat ellipse, seen from a little above: this much as tall as it is wide. */
export const PAD_FLATTEN = 0.24;
/** Production's pad carries a second, wider ring. */
export const PRODUCTION_RING = 1.22;
/** The latest deployment's beacon rides its beam this far above the pad. */
const BEACON_RISE_SHARE = 0.16;
const MIN_BEACON_RISE_PX = 40;
export const BEACON_RADIUS_PX = 11;
/** The trail climbs in even steps, room for this many earlier deployments, never steeper. */
const TRAIL_ROOM = 7;
const MAX_TRAIL_STEP_PX = 64;
/** The trail stops this far below the top of the stage. */
const TRAIL_CEILING_SHARE = 0.04;
const TRAIL_RADIUS_PX = 6.5;
const TRAIL_SHRINK = 0.84;
const MIN_TRAIL_RADIUS_PX = 2.4;
const TRAIL_FADE = 0.09;
const MIN_TRAIL_ALPHA = 0.3;
/** How far the trail drifts sideways, as a share of its column, by its top. Scenery. */
const DRIFT_SHARE = 0.22;
const DRIFT_WAVE = 0.85;

export const EMPTY_LAYOUT: PadLayout = { pads: [], deployments: [] };

/** An earlier deployment's size: smaller the further up its trail. */
export const trailRadius = (age: number): number =>
  Math.max(MIN_TRAIL_RADIUS_PX, TRAIL_RADIUS_PX * TRAIL_SHRINK ** (age - 1));

/** An earlier deployment's brightness: dimmer the further up its trail. */
export const trailAlpha = (age: number): number => Math.max(MIN_TRAIL_ALPHA, 1 - age * TRAIL_FADE);

interface Column {
  readonly x: number;
  readonly width: number;
}

/** Each environment's column across the stage, centred, none wider than the cap. */
function columnsOf(count: number, stage: Stage): Column[] {
  const width = Math.min(MAX_COLUMN_PX, stage.width / Math.max(1, count));
  const start = stage.left + (stage.width - width * count) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: start + width * (index + 0.5),
    width,
  }));
}

function padOf(environment: DeployEnvironment, column: Column, y: number): PlacedPad {
  return {
    key: environment.name,
    name: environment.name,
    isProduction: environment.isProduction,
    x: column.x,
    y,
    reach: Math.min(MAX_PAD_REACH_PX, column.width * PAD_REACH_SHARE),
    count: environment.deployments.length,
    latest: environment.deployments[0]?.outcome ?? null,
  };
}

/** The beacon on its beam, then the earlier deployments climbing away from it. */
function lightsOf(
  environment: DeployEnvironment,
  pad: PlacedPad,
  column: Column,
  stage: Stage,
): PlacedDeployment[] {
  const beaconY = pad.y - Math.max(MIN_BEACON_RISE_PX, stage.height * BEACON_RISE_SHARE);
  const ceiling = stage.top + stage.height * TRAIL_CEILING_SHARE;
  const step = Math.min(MAX_TRAIL_STEP_PX, Math.max(0, beaconY - ceiling) / TRAIL_ROOM);
  const phase = seededRandom(hashString(environment.name))() * Math.PI * 2;
  const drift = column.width * DRIFT_SHARE;
  return environment.deployments.map((deployment, age) => ({
    key: String(deployment.id),
    deployment,
    age,
    padKey: pad.key,
    x: pad.x + drift * (age / TRAIL_ROOM) * Math.sin(age * DRIFT_WAVE + phase),
    y: beaconY - step * age,
    radius: age === 0 ? BEACON_RADIUS_PX : trailRadius(age),
    alpha: age === 0 ? 1 : trailAlpha(age),
  }));
}

/** Where every pad and every deployment's light goes on `stage`. */
export function layoutPads(environments: readonly DeployEnvironment[], stage: Stage): PadLayout {
  if (!environments.length || stage.width <= 0 || stage.height <= 0) return EMPTY_LAYOUT;
  const columns = columnsOf(environments.length, stage);
  const padY = stage.top + stage.height * PAD_DEPTH;
  const pads = environments.map((environment, index) => padOf(environment, columns[index], padY));
  const deployments = environments.flatMap((environment, index) =>
    lightsOf(environment, pads[index], columns[index], stage),
  );
  return { pads, deployments };
}
