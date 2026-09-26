import { DEG, ECLIPTIC, ORBIT, TIER_RING } from './proportions';
import { tiltInto } from './tilt';

const LOOP_SEGMENTS = 96;
const ARC_POINTS = 40;
const TIER_COUNT = 3;
/** Each tier's arc spans this much of its third of the ring, leaving gaps between. */
const ARC_SPAN_DEG = 102;
const ARC_START_DEG = 9;

/** The orbit the beads ride, as a closed loop of points. */
export function orbitLoop(coreRadius: number): Float32Array {
  const radius = coreRadius * ORBIT;
  const points = new Float32Array(LOOP_SEGMENTS * 3);
  for (let i = 0; i < LOOP_SEGMENTS; i++) {
    const angle = (i / LOOP_SEGMENTS) * Math.PI * 2;
    tiltInto(points, i, { x: Math.sin(angle) * radius, y: 0, z: -Math.cos(angle) * radius });
  }
  return points;
}

/** Three arcs, one per tier, on a ring rolled off the orbit and turned by `spin`. */
export function tierArcs(coreRadius: number, spin: number): readonly Float32Array[] {
  const radius = coreRadius * TIER_RING;
  const rollCos = Math.cos(ECLIPTIC);
  const rollSin = Math.sin(ECLIPTIC);
  return Array.from({ length: TIER_COUNT }, (_, tier) => {
    const points = new Float32Array(ARC_POINTS * 3);
    for (let i = 0; i < ARC_POINTS; i++) {
      const along = (tier * 120 + ARC_START_DEG + (i / (ARC_POINTS - 1)) * ARC_SPAN_DEG) * DEG;
      const angle = spin + along;
      const across = Math.sin(angle) * radius;
      tiltInto(points, i, {
        x: across * rollCos,
        y: across * rollSin,
        z: -Math.cos(angle) * radius,
      });
    }
    return points;
  });
}
