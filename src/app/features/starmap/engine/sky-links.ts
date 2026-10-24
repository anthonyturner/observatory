import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Scene,
} from 'three';
import { CameraController } from './camera-controller';
import { starRadius } from './canvas-sky';
import { Kit } from './gpu-kit';
import { FLOW_INK, LINK_GAP, LINK_INK, trimSegment } from './link-ink';
import { SkyFrame } from './sky-frame';
import { SkyCluster, SkyStar } from './sky-model';

/** A geometry of `points` vertices, all at the origin until the frame places them. */
const blank = (points: number): BufferGeometry =>
  new BufferGeometry().setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(points * 3), 3),
  );

/** One link drawn between neighbouring stars of a constellation; the object and
 *  its material outlive the layout, the geometry is sized to each. */
interface Link {
  readonly object: LineSegments;
  cluster: SkyCluster | null;
}

/**
 * The lines the sky draws between its stars: a constellation's links, and the
 * dashed flow that runs through the clusters. Both depend on the layout, so a
 * refresh resizes them; the objects and materials are made once.
 */
export class SkyLinks {
  private readonly links: Link[] = [];
  private readonly flow: Line;
  private readonly dashTime = { value: 0 };
  private route: readonly SkyStar[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly kit: Kit,
    private readonly camera: CameraController,
  ) {
    const material = kit.owned.own(
      new LineDashedMaterial({
        color: FLOW_INK,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        dashSize: 1.5,
        gapSize: 7.5,
      }),
    );
    material.onBeforeCompile = (shader) => {
      shader.uniforms['dashTime'] = this.dashTime;
      shader.fragmentShader =
        'uniform float dashTime;\n' +
        shader.fragmentShader.replace(
          'mod( vLineDistance, totalSize )',
          'mod( vLineDistance - dashTime, totalSize )',
        );
    };
    this.flow = new Line(kit.owned.own(blank(0)), material);
    scene.add(this.flow);
  }

  /** Resizes the links and the flow to this layout. */
  load(clusters: readonly SkyCluster[]): void {
    const { owned } = this.kit;
    const linked = clusters.filter((c) => c.stars.length > 1 && !c.arm);
    while (this.links.length < linked.length) this.links.push(this.makeLink());
    this.links.forEach((link, i) => {
      link.cluster = linked[i] ?? null;
      link.object.visible = link.cluster !== null;
      owned.free(link.object.geometry);
      link.object.geometry = owned.own(
        blank(link.cluster ? 2 * (link.cluster.stars.length - 1) : 0),
      );
    });
    this.route = clusters.flatMap((c) =>
      c.stars.length ? [c.stars[0], c.stars[c.stars.length - 1]] : [],
    );
    owned.free(this.flow.geometry);
    this.flow.geometry = owned.own(blank(this.route.length));
  }

  update(f: SkyFrame): void {
    const { t } = f;
    for (const { object, cluster } of this.links) {
      if (!cluster) continue;
      this.placeSegments(f, object, cluster.stars);
      (object.material as LineBasicMaterial).opacity =
        (0.5 + Math.sin(t * 0.62 + cluster.cx * 0.004) * 0.12) * f.dimCluster(cluster);
    }
    this.flow.visible = f.chart === 'prs' && this.route.length > 1;
    if (this.route.length) {
      this.placeLine(this.flow, this.route);
      this.flow.computeLineDistances();
    }
    (this.flow.material as LineDashedMaterial).scale = f.camera.current.scale;
    this.dashTime.value = t * 30;
  }

  private makeLink(): Link {
    const material = this.kit.owned.own(
      new LineBasicMaterial({
        color: LINK_INK,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    const object = new LineSegments(this.kit.owned.own(blank(0)), material);
    this.scene.add(object);
    return { object, cluster: null };
  }

  private placeLine(object: Line, members: readonly SkyStar[]): void {
    const p = object.geometry.attributes['position'];
    members.forEach((s, i) => p.setXYZ(i, s.ax, -s.ay, s.az));
    p.needsUpdate = true;
    object.geometry.computeBoundingSphere();
  }

  /** Each segment of a constellation, stopped short of its stars by their
   *  on-screen gap carried back to each star's depth. */
  private placeSegments(f: SkyFrame, object: LineSegments, members: readonly SkyStar[]): void {
    const p = object.geometry.attributes['position'];
    const scale = f.camera.current.scale;
    const gap = (s: SkyStar): number =>
      (starRadius(f, s, f.born(s)) + LINK_GAP) / (scale * this.camera.depth(s.az));
    const at = (s: SkyStar) => ({ x: s.ax, y: -s.ay, z: s.az });
    for (let i = 1; i < members.length; i++) {
      const a = members[i - 1];
      const b = members[i];
      const [from, to] = trimSegment(at(a), at(b), gap(a), gap(b)) ?? [at(a), at(a)];
      p.setXYZ(2 * i - 2, from.x, from.y, from.z);
      p.setXYZ(2 * i - 1, to.x, to.y, to.z);
    }
    p.needsUpdate = true;
    object.geometry.computeBoundingSphere();
  }
}
