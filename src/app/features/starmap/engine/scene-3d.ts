import {
  AdditiveBlending,
  BufferGeometry,
  Line,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  WebGLRenderer,
} from 'three';
import { STAR_INSTANCED_FRAGMENT, STAR_INSTANCED_VERTEX } from '../../../shared/gl/star-shader';
import { CameraController } from './camera-controller';
import { FieldStars } from './field-stars';
import { GalaxyLayer } from './galaxy-layer';
import { Instanced, Kit, place, vec } from './gpu-kit';
import { InstanceBatch } from './instance-batch';
import { NewsEffects3D } from './news-3d';
import { rnd } from './rnd';
import { LogThreads, NewsEffect3D, SkyFrame, SkyScene } from './sky-frame';
import { SkyInstances } from './sky-instances';
import { SkyLinks } from './sky-links';
import {
  DISC_FRAGMENT,
  DISC_VERTEX,
  PLANET_FRAGMENT,
  PLANET_VERTEX,
  PULSE_FRAGMENT,
  PULSE_VERTEX,
} from './star-system-shaders';
import { Threads3D } from './threads-3d';

/* The 3D scene of the sky: what stays for the life of the renderer, and what a
   new layout resizes. The renderer around it owns the camera and the passes. */

/** What the sky's passes work at: CSS resolution on Retina displays, which a
 *  blur would not show more of. */
export const sceneRatio = (): number => Math.min(globalThis.devicePixelRatio || 1, 1.25);

/** The disc of the galaxy is drawn this many texels to a pixel of the scene. */
const GALAXY_DETAIL = 0.75;

export interface SceneModel {
  /** Shows this layout, reusing every part that does not depend on it. */
  load(data: SkyScene): void;
  update(f: SkyFrame, gl: WebGLRenderer): void;
  dispose(): void;
}

interface InstancedDraw<K extends string> {
  /** The shape drawn once per instance. */
  readonly base: BufferGeometry;
  readonly batch: InstanceBatch<K>;
  readonly material: ShaderMaterial;
  /** Draws the shape as a line, not as a surface. */
  readonly line?: boolean;
}

/** One draw call for a batch of marks, which follows the batch as it is laid out again. */
class InstancedMarks<K extends string> {
  private readonly marks: Instanced<K>;
  private readonly object: Mesh | Line;
  private readonly batch: InstanceBatch<K>;

  constructor(scene: Scene, kit: Kit, { base, batch, material, line }: InstancedDraw<K>) {
    this.batch = batch;
    this.marks = kit.instanced(base, batch);
    const owned = kit.owned.own(material);
    this.object = line
      ? new Line(this.marks.geometry, owned)
      : new Mesh(this.marks.geometry, owned);
    // The base shape's bounds say nothing of where the instances are.
    this.object.frustumCulled = false;
    scene.add(this.object);
    this.reload();
  }

  /** Follows the batch after it was laid out again. */
  reload(): void {
    this.object.geometry = this.marks.sync();
    this.object.visible = this.batch.count > 0;
  }

  /** Sends the frame's rewritten values to the GPU. */
  upload(): void {
    this.marks.upload();
  }
}

/** Builds what the sky keeps for good: the galaxy, the field, the nebula, the
 *  shared shapes, the materials and the effects. Showing a layout then only
 *  resizes the stars' batches, the links and the flow. */
export function buildScene3D(scene: Scene, kit: Kit, camera: CameraController): SceneModel {
  const { owned } = kit;
  const galaxy = new GalaxyLayer(scene, owned);
  const field = new FieldStars(scene, owned);
  // Soft cloud cells at distinct depths form the nebula volume.
  const cloudMap = kit.texture((c, size) => {
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#ffffff55');
    g.addColorStop(1, '#ffffff00');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  });
  const clouds: { cloud: Sprite; x: number; y: number; z: number; phase: number }[] = [];
  const nr = rnd(31337);
  for (let i = 0; i < 18; i++) {
    const cloud = kit.sprite(cloudMap, ['#3b2a8f', '#12507a', '#57208f', '#0f6a72'][i % 4], 0.009);
    const x = nr() * 9000 - 2600;
    const y = nr() * 5000 - 1600;
    const z = -1500 - nr() * 7000;
    cloud.position.copy(vec(x, y, z));
    cloud.scale.setScalar(1400 + nr() * 2200);
    scene.add(cloud);
    clouds.push({ cloud, x, y, z, phase: nr() * 6.28 });
  }

  const instances = new SkyInstances();
  const time = { value: 0 };
  const quad = owned.own(new PlaneGeometry(1, 1));
  const ball = owned.own(new SphereGeometry(1, 16, 12));
  const ring = owned.own(
    new BufferGeometry().setFromPoints(
      Array.from({ length: 65 }, (_, i) =>
        vec(Math.cos((i / 64) * Math.PI * 2), Math.sin((i / 64) * Math.PI * 2)),
      ),
    ),
  );
  const glow = (vertexShader: string, fragmentShader: string): ShaderMaterial =>
    new ShaderMaterial({
      uniforms: { time },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
  // One draw per kind. All four sit at the same depth, so three.js draws them in
  // the order they are added: planets first, as they write depth, which hides
  // the glow behind one and still lets the glow in front of it add on top.
  const draws = [
    new InstancedMarks(scene, kit, {
      base: ball,
      batch: instances.planets,
      material: new ShaderMaterial({
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
        transparent: true,
      }),
    }),
    new InstancedMarks(scene, kit, {
      base: quad,
      batch: instances.discs,
      material: glow(DISC_VERTEX, DISC_FRAGMENT),
    }),
    new InstancedMarks(scene, kit, {
      base: quad,
      batch: instances.bodies,
      material: glow(STAR_INSTANCED_VERTEX, STAR_INSTANCED_FRAGMENT),
    }),
    new InstancedMarks(scene, kit, {
      base: ring,
      batch: instances.pulses,
      line: true,
      material: new ShaderMaterial({
        vertexShader: PULSE_VERTEX,
        fragmentShader: PULSE_FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    }),
  ];
  const links = new SkyLinks(scene, kit, camera);

  const news = new NewsEffects3D({
    scene,
    kit,
    camera,
    toScreen: (x, y, z) => camera.project(x, y, z),
  });

  const threads = new Threads3D(scene, kit);

  // Refilled each frame; the news effects read it at once and keep nothing of it.
  const bursts: NewsEffect3D[] = [];
  const collectEffects = (f: SkyFrame): readonly NewsEffect3D[] => {
    bursts.length = 0;
    for (const layer of f.layers) {
      const playing = layer.effects3D?.(f);
      if (playing?.length) bursts.push(...playing);
    }
    return bursts;
  };
  const firstThreads = (f: SkyFrame): LogThreads | null => {
    for (const layer of f.layers) {
      const traced = layer.threads3D?.(f);
      if (traced) return traced;
    }
    return null;
  };

  return {
    load(data: SkyScene): void {
      field.load(data.field);
      instances.load(data.stars);
      for (const draw of draws) draw.reload();
      links.load(data.clusters);
    },
    update(f: SkyFrame, gl: WebGLRenderer): void {
      const { t } = f;
      const cam = f.camera.current;
      const ratio = sceneRatio();
      galaxy.update(f, gl, ratio * GALAXY_DETAIL);
      field.update(t, ratio);
      for (const { cloud, x, y, z, phase } of clouds) {
        place(cloud.position, x + Math.sin(t * 0.035 + phase) * 50, y, z);
      }
      time.value = f.frozen ? 0 : t;
      instances.update(f, (z) => camera.depth(z));
      for (const draw of draws) draw.upload();
      links.update(f);
      news.update(collectEffects(f));
      // Log threads follow the same fault across windows, bowed in 3D.
      threads.update(firstThreads(f), cam.scale);
    },
    dispose(): void {
      news.dispose();
      threads.dispose();
    },
  };
}
