import { plural } from '../../../shared/text/plural';
import { outcomeColour } from '../deploy-look';
import { deploymentSpoken, deploymentTip } from '../deploy-words';
import {
  PAD_FLATTEN,
  PRODUCTION_RING,
  PadLayout,
  PlacedDeployment,
  PlacedPad,
} from './launch-pads';

/** A deployment's light as a link over the canvas, so it can be hovered, focused and followed. */
export interface LightMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** The link's width and height, never smaller than a fingertip. */
  readonly hit: number;
  /** The deployed site, or the commit on GitHub when there is none. */
  readonly href: string;
  readonly tip: string;
  readonly spoken: string;
}

/** An environment's name under its pad. */
export interface PadMark {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly name: string;
  /** "production · 8 deployments". */
  readonly detail: string;
  /** The name's dot, coloured as its latest deployment went: a CSS colour. */
  readonly colour: string;
}

export interface LaunchMarks {
  /** By environment, newest first: the order Tab takes. */
  readonly lights: readonly LightMark[];
  readonly pads: readonly PadMark[];
}

const MIN_HIT_PX = 24;
const HIT_PER_RADIUS = 2.6;
/** Below the outermost ring a pad can have, so no name sits on one. */
const PAD_LABEL_GAP_PX = 8;
const NO_DEPLOYMENT_COLOUR = 'var(--muted)';

function lightMark(placed: PlacedDeployment, now: number): LightMark {
  const { deployment } = placed;
  return {
    key: placed.key,
    x: placed.x,
    y: placed.y,
    hit: Math.max(MIN_HIT_PX, placed.radius * HIT_PER_RADIUS),
    href: deployment.url ?? deployment.commitUrl,
    tip: deploymentTip(deployment, now),
    spoken: deploymentSpoken(deployment, now),
  };
}

function padMark(pad: PlacedPad): PadMark {
  const count = plural(pad.count, 'deployment');
  return {
    key: pad.key,
    x: pad.x,
    y: pad.y + pad.reach * PAD_FLATTEN * PRODUCTION_RING + PAD_LABEL_GAP_PX,
    name: pad.name,
    detail: pad.isProduction ? `production · ${count}` : count,
    colour: pad.latest ? outcomeColour(pad.latest) : NO_DEPLOYMENT_COLOUR,
  };
}

/** The links and names the sky lays over its canvas, `now` being when the report was made. */
export function launchMarks(layout: PadLayout, now: number): LaunchMarks {
  return {
    lights: layout.deployments.map((placed) => lightMark(placed, now)),
    pads: layout.pads.map(padMark),
  };
}
