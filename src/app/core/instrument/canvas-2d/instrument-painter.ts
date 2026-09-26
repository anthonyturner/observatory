import { BeadOverflow } from '../beads';
import { TierLevels } from '../core-states';
import { FloorGrid, floorBatches } from '../floor-grid';
import { Lens } from '../lens';
import { CorePalette } from '../palette';

export type StrokeMode = 'line' | 'loop';

const ORBIT_ALPHA = 0.22;

/** The floor's batches as paths, built once per grid. */
export function floorPaths(grid: FloorGrid): { alpha: number; path: Path2D }[] {
  return floorBatches(grid).map(({ alpha, segments }) => {
    const path = new Path2D();
    for (let i = 0; i < segments.length; i += 4) {
      path.moveTo(segments[i], segments[i + 1]);
      path.lineTo(segments[i + 2], segments[i + 3]);
    }
    return { alpha, path };
  });
}

export interface FloorStroke {
  readonly paths: readonly { alpha: number; path: Path2D }[];
  readonly centreX: number;
  readonly centreY: number;
  readonly fade: number;
}

/** The floor is laid out flat about the core's centre, so it moves with it. */
export function paintFloor(
  context: CanvasRenderingContext2D,
  palette: CorePalette,
  floor: FloorStroke,
): void {
  context.save();
  context.translate(floor.centreX, floor.centreY);
  context.strokeStyle = palette.floor;
  for (const { alpha, path } of floor.paths) {
    context.globalAlpha = alpha * floor.fade;
    context.stroke(path);
  }
  context.restore();
}

export function strokePoints(
  context: CanvasRenderingContext2D,
  lens: Lens,
  points: Float32Array,
  mode: StrokeMode,
): void {
  context.beginPath();
  for (let i = 0; i < points.length / 3; i++) {
    const seen = lens.project(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
    if (i === 0) context.moveTo(seen.x, seen.y);
    else context.lineTo(seen.x, seen.y);
  }
  if (mode === 'loop') context.closePath();
  context.stroke();
}

export interface Rings {
  readonly orbit: Float32Array;
  readonly tiers: readonly Float32Array[];
  readonly lit: TierLevels;
  readonly fade: number;
}

/** The orbit the beads ride, then the three tier arcs, each lit by the core's state. */
export function paintRings(
  context: CanvasRenderingContext2D,
  lens: Lens,
  palette: CorePalette,
  rings: Rings,
): void {
  context.strokeStyle = palette.ring;
  context.globalAlpha = ORBIT_ALPHA * rings.fade;
  strokePoints(context, lens, rings.orbit, 'loop');
  rings.tiers.forEach((arc, tier) => {
    context.globalAlpha = rings.lit[tier] * rings.fade;
    strokePoints(context, lens, arc, 'line');
  });
}

/** "+n" for the projects past the last bead. */
export function paintOverflow(
  context: CanvasRenderingContext2D,
  lens: Lens,
  palette: CorePalette,
  overflow: BeadOverflow,
): void {
  const seen = lens.project(overflow.x, overflow.y, overflow.z);
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = palette.mark;
  context.font = palette.markFont;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`+${overflow.count}`, seen.x, seen.y);
  context.restore();
}
