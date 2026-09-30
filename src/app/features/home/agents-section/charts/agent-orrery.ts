import { AgentRun } from '../../../../core/agent-usage/agent-usage-document';
import { tenth } from '../../../../shared/charts/chart-marks';
import { STANDARD_WINDOW, groupTip, groupTotals } from './agent-stats';

/** One agent as a moon round the core. */
export interface Moon {
  readonly id: string;
  readonly label: string;
  readonly colour: string;
  readonly orbitX: number;
  readonly orbitY: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** The arc round it: its average peak context against the standard window. */
  readonly arcRadius: number;
  readonly arcDash: string;
  readonly tip: string;
}

export interface Orrery {
  readonly size: number;
  readonly centre: number;
  readonly moons: readonly Moon[];
}

const SIZE = 360;
const CENTRE = SIZE / 2;
const FIRST_ORBIT = 62;
const ORBIT_STEP = 22;
/** Orbits are ellipses, tilted like the core's own rings. */
const TILT = 0.62;
const MIN_MOON = 5;
const MOON_GROWTH = 12;
const ARC_GAP = 4;

/** F: each agent a moon on its own orbit, pipeline order from the core out,
 *  sized by its work and ringed by how full its contexts get. */
export function agentOrrery(runs: readonly AgentRun[]): Orrery {
  const totals = groupTotals(runs);
  const most = Math.max(1, ...totals.map((each) => each.workTokens));
  return {
    size: SIZE,
    centre: CENTRE,
    moons: totals.map((each, index) => {
      const orbit = FIRST_ORBIT + index * ORBIT_STEP;
      // Spread round the orbit so neighbours never sit on top of one another.
      const angle = (index / totals.length) * Math.PI * 2 + index * 0.7 - Math.PI / 2;
      const radius = tenth(MIN_MOON + Math.sqrt(each.workTokens / most) * MOON_GROWTH);
      const arcRadius = radius + ARC_GAP;
      const circumference = 2 * Math.PI * arcRadius;
      const share = Math.min(1, each.averagePeak / STANDARD_WINDOW);
      return {
        id: each.group.id,
        label: each.group.label,
        colour: each.group.colour,
        orbitX: orbit,
        orbitY: tenth(orbit * TILT),
        x: tenth(CENTRE + Math.cos(angle) * orbit),
        y: tenth(CENTRE + Math.sin(angle) * orbit * TILT),
        radius,
        arcRadius,
        arcDash: `${tenth(circumference * share)} ${tenth(circumference)}`,
        tip: `${groupTip(each)}\nClick to light it in the chart below`,
      };
    }),
  };
}
