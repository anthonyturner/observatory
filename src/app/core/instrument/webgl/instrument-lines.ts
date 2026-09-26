import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
} from 'three';
import { CorePose } from '../core-animator';
import { FLOOR_STRIDE, FloorGrid } from '../floor-grid';
import { RippleEllipse } from '../refresh-ripple';
import { tierArcs } from '../rings';
import { GpuResources } from './gpu-resources';

/** The floor this frame: how much of it shows, how bright, and the wave on it. */
export interface FloorMoment {
  readonly lift: number;
  readonly brightness: number;
  readonly rings: readonly RippleEllipse[];
}

export interface InstrumentParts {
  readonly floor: FloorGrid;
  readonly orbit: Float32Array;
  readonly coreRadius: number;
  readonly floorInk: string;
  readonly ringInk: string;
}

const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: AdditiveBlending,
} as const;
const ORBIT_ALPHA = 0.22;
/** Light adds in linear space here, which lifts faint lines; this brings the
 *  floor back level with the 2D core's. */
const FLOOR_LEVEL = 0.6;
const RIPPLE_POINTS = 64;
/** At most this many rings are in flight at once. */
const RIPPLE_LINES = 2;

/** The floor, the orbit and the tier arcs: lines about the core's centre. */
export class InstrumentLines {
  readonly group = new Group();
  private readonly floorMaterial: LineBasicMaterial;
  private readonly orbitMaterial: LineBasicMaterial;
  private readonly ripples: { readonly line: Line; readonly material: LineBasicMaterial }[];
  private readonly tiers: {
    readonly line: Line;
    readonly positions: BufferAttribute;
    readonly material: LineBasicMaterial;
  }[];

  constructor(
    private readonly parts: InstrumentParts,
    resources: GpuResources,
  ) {
    this.floorMaterial = resources.own(new LineBasicMaterial({ vertexColors: true, ...ADDITIVE }));
    this.orbitMaterial = resources.own(
      new LineBasicMaterial({ color: parts.ringInk, ...ADDITIVE }),
    );
    const floor = new LineSegments(this.floorGeometry(resources), this.floorMaterial);
    const orbit = new LineLoop(this.pointsGeometry(parts.orbit, resources), this.orbitMaterial);
    this.tiers = tierArcs(parts.coreRadius, 0).map((arc) => {
      const positions = new BufferAttribute(new Float32Array(arc.length), 3);
      const geometry = resources.own(new BufferGeometry());
      geometry.setAttribute('position', positions);
      const material = resources.own(new LineBasicMaterial({ color: parts.ringInk, ...ADDITIVE }));
      return { line: new Line(geometry, material), positions, material };
    });
    this.ripples = Array.from({ length: RIPPLE_LINES }, () => {
      const material = resources.own(new LineBasicMaterial({ color: parts.floorInk, ...ADDITIVE }));
      return { line: new Line(halfEllipse(resources), material), material };
    });
    const ripples = this.ripples.map((ripple) => ripple.line);
    for (const object of [floor, orbit, ...ripples, ...this.tiers.map((tier) => tier.line)]) {
      object.frustumCulled = false;
      this.group.add(object);
    }
  }

  update(pose: CorePose, floor: FloorMoment): void {
    this.floorMaterial.opacity = pose.intro * floor.lift * floor.brightness;
    this.ripples.forEach(({ line, material }, i) => {
      const ring = floor.rings[i];
      line.visible = ring !== undefined;
      if (!ring) return;
      line.position.set(0, ring.centreY, 0);
      line.scale.set(Math.max(ring.radiusX, 1e-3), Math.max(ring.radiusY, 1e-3), 1);
      material.opacity = ring.alpha;
    });
    this.orbitMaterial.opacity = ORBIT_ALPHA * pose.intro;
    const arcs = tierArcs(this.parts.coreRadius, pose.tierSpin);
    this.tiers.forEach(({ positions, material }, tier) => {
      positions.array.set(arcs[tier]);
      positions.needsUpdate = true;
      material.opacity = pose.tierLevels[tier] * pose.intro;
    });
  }

  private floorGeometry(resources: GpuResources): BufferGeometry {
    const ink = new Color(this.parts.floorInk);
    const positions: number[] = [];
    const colours: number[] = [];
    const { segments } = this.parts.floor;
    for (let i = 0; i < segments.length; i += FLOOR_STRIDE) {
      positions.push(segments[i], segments[i + 1], 0, segments[i + 2], segments[i + 3], 0);
      for (const alpha of [segments[i + 4], segments[i + 5]]) {
        const level = alpha * FLOOR_LEVEL;
        colours.push(ink.r * level, ink.g * level, ink.b * level);
      }
    }
    const geometry = resources.own(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    return geometry;
  }

  private pointsGeometry(points: Float32Array, resources: GpuResources): BufferGeometry {
    const geometry = resources.own(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(points, 3));
    return geometry;
  }
}

/** The lower half of a unit ellipse, y down; scaled to each ring as it spreads. */
function halfEllipse(resources: GpuResources): BufferGeometry {
  const points = new Float32Array(RIPPLE_POINTS * 3);
  for (let i = 0; i < RIPPLE_POINTS; i++) {
    const angle = (i / (RIPPLE_POINTS - 1)) * Math.PI;
    points[i * 3] = Math.cos(angle);
    points[i * 3 + 1] = Math.sin(angle);
  }
  const geometry = resources.own(new BufferGeometry());
  geometry.setAttribute('position', new BufferAttribute(points, 3));
  return geometry;
}
