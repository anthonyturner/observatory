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
import { tierArcs } from '../rings';
import { GpuResources } from './gpu-resources';

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

/** The floor, the orbit and the tier arcs: lines about the core's centre. */
export class InstrumentLines {
  readonly group = new Group();
  private readonly floorMaterial: LineBasicMaterial;
  private readonly orbitMaterial: LineBasicMaterial;
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
    for (const object of [floor, orbit, ...this.tiers.map((tier) => tier.line)]) {
      object.frustumCulled = false;
      this.group.add(object);
    }
  }

  update(pose: CorePose, lift: number): void {
    this.floorMaterial.opacity = pose.intro * lift;
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
