import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { MAX_SPARKS, sparkColour } from '../memory/comment-sparks';
import { CameraController } from './camera-controller';
import { Kit, vec } from './gpu-kit';
import { rnd } from './rnd';
import { NewsEffect3D } from './sky-frame';
import {
  EmberLook,
  coolLook,
  coolProgress,
  sinkHead,
  sinkLook,
  sinkProgress,
} from '../memory/closed-ember';
import { DEPARTED_MAG, STREAK_RISE, streakHead, streakTravel } from '../memory/departure-exit';
import {
  NOVA_FLASH,
  NOVA_RING,
  novaLook,
  novaProgress,
  streakProgress,
} from '../memory/merge-supernova';
import {
  COLLAPSE_CORE,
  COLLAPSE_RING,
  collapseLook,
  collapseProgress,
  squashStreakProgress,
} from '../memory/squash-collapse';

/* pr-starmap's 3D news: shells, a flash and debris that expand or fall
   inward on a star, and a streak for a pull request crossing the sky as it
   leaves. Each effect owns its geometry and lifetime. */

const ease = (p: number): number => 1 - Math.pow(1 - p, 3);

interface Effect3D {
  update(request: NewsEffect3D): void;
  dispose(): void;
}

interface Context {
  readonly scene: Scene;
  readonly kit: Kit;
  readonly camera: CameraController;
  readonly toScreen: (x: number, y: number, z?: number) => [number, number];
}

/** The size a star of this magnitude is drawn at, in world units at its depth. */
const worldRadius = (mag: number, az: number, camera: CameraController): number => {
  const scale = camera.current.scale;
  return (mag * Math.max(scale, 0.42)) / (scale * camera.depth(az));
};

type Own = <T extends { dispose(): void }>(resource: T) => T;

const flashMesh = (own: Own, colour: string): Mesh<SphereGeometry, MeshBasicMaterial> =>
  new Mesh(
    own(new SphereGeometry(1, 20, 12)),
    own(
      new MeshBasicMaterial({
        color: new Color(colour).multiplyScalar(2),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    ),
  );

/** A glowing rim round a sphere: seen from the front, a ring. */
const shellMesh = (own: Own, colour: string): Mesh<SphereGeometry, ShaderMaterial> =>
  new Mesh(
    own(new SphereGeometry(1, 24, 16)),
    own(
      new ShaderMaterial({
        uniforms: { ink: { value: new Color(colour) }, opacity: { value: 1 } },
        vertexShader: `varying vec3 n; varying vec3 v; void main() {
          vec4 p = modelViewMatrix * vec4(position,1.); n = normalize(normalMatrix * normal); v = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`,
        fragmentShader: `varying vec3 n; varying vec3 v; uniform vec3 ink; uniform float opacity;
          void main() { float rim = pow(1. - abs(dot(normalize(n),normalize(v))),3.);
          gl_FragColor = vec4(ink * 1.6, rim * opacity); }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    ),
  );

/** Draws a material's points as discs, not squares. */
const roundPoints = (material: PointsMaterial): void => {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nif (length(gl_PointCoord - vec2(.5)) > .5) discard;',
    );
  };
};

function expanding(ctx: Context, request: NewsEffect3D): Effect3D {
  const { scene, kit, camera } = ctx;
  const own: Own = (resource) => kit.owned.own(resource);
  const mode = request.mode as 'nova' | 'supernova' | 'implode';
  const group = new Group();
  scene.add(group);
  const colour = mode === 'nova' ? '#ffffff' : mode === 'implode' ? '#5fe3a1' : request.colour;
  const flash = flashMesh(own, '#ffffff');
  group.add(flash);
  const shells = Array.from({ length: mode === 'implode' ? 3 : mode === 'nova' ? 1 : 2 }, () => {
    const shell = shellMesh(own, colour);
    group.add(shell);
    return shell;
  });
  const random = rnd(request.seed * 7919);
  const directions = Array.from({ length: mode === 'nova' ? 8 : 22 }, () => {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    return new Vector3(Math.sqrt(1 - z * z) * Math.cos(a), Math.sqrt(1 - z * z) * Math.sin(a), z);
  });
  const debris = new Points(
    own(new BufferGeometry().setFromPoints(directions)),
    own(
      new PointsMaterial({
        color: colour,
        size: 2.5,
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    ),
  );
  roundPoints(debris.material);
  group.add(debris);
  return {
    update({ p, star }) {
      if (!star) return;
      group.position.copy(vec(star.ax, star.ay, star.az));
      const r = worldRadius(star.mag, star.az, camera);
      flash.visible = mode === 'nova' || (mode === 'supernova' && p < 0.25);
      flash.scale.setScalar(r * (mode === 'nova' ? 1 + ease(p) * 5 : 2 + p * 14));
      flash.material.opacity = mode === 'nova' ? (1 - p) * 0.9 : Math.max(0, 1 - p / 0.25);
      shells.forEach((shell, k) => {
        const q = Math.min(
          1,
          Math.max(0, mode === 'implode' ? p * 1.3 - k * 0.15 : (p - k * 0.12) / (1 - k * 0.12)),
        );
        shell.scale.setScalar(
          r *
            (mode === 'implode'
              ? 1.2 + (1 - ease(q)) * 12
              : 2 + ease(q) * (mode === 'nova' ? 5 : 24)),
        );
        shell.material.uniforms['opacity'].value =
          mode === 'implode' ? Math.sin(q * Math.PI) * 0.7 : (1 - q) * 0.85;
      });
      debris.scale.setScalar(r * (mode === 'implode' ? (1 - ease(p)) * 12 : 3 + ease(p) * 25));
      debris.material.opacity = 1 - p;
    },
    dispose() {
      kit.owned.release(group);
    },
  };
}

const STREAK_POINTS = 20;

function shooting(ctx: Context, request: NewsEffect3D): Effect3D {
  const { scene, kit } = ctx;
  const streak = kit.line(
    Array.from({ length: STREAK_POINTS }, () => vec(0, 0)),
    request.colour,
  );
  const col = new Color(request.colour);
  const colours: number[] = [];
  for (let i = 0; i < STREAK_POINTS; i++) {
    const k = i / (STREAK_POINTS - 1);
    colours.push(col.r * k, col.g * k, col.b * k);
  }
  streak.geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  const material = streak.material as LineBasicMaterial;
  material.color.set('#ffffff');
  material.vertexColors = true;
  scene.add(streak);
  return {
    update({ p, from, angle, onHead }) {
      const travel = streakTravel(p);
      const tail = 170 * (1 - p * 0.4);
      const attr = streak.geometry.attributes['position'];
      for (let i = 0; i < STREAK_POINTS; i++) {
        const d = travel - tail * (1 - i / (STREAK_POINTS - 1));
        attr.setXYZ(
          i,
          from.x + Math.cos(angle) * d,
          -(from.y + Math.sin(angle) * d),
          from.z + d * STREAK_RISE,
        );
      }
      attr.needsUpdate = true;
      streak.geometry.computeBoundingSphere();
      material.opacity = 1 - p ** 3;
      const head = streakHead(from, angle, p);
      onHead?.(ctx.toScreen(head.x, head.y, head.z));
    },
    dispose() {
      kit.owned.release(streak);
    },
  };
}

/** An exit's first act, then unless motion is off the streak it hands over to. */
function thenStreak(
  ctx: Context,
  request: NewsEffect3D,
  first: Effect3D,
  along: (p: number) => number,
): Effect3D {
  let streak: Effect3D | null = null;
  return {
    update(update) {
      first.update(update);
      const progress = along(update.p);
      if (update.still || progress <= 0) return;
      streak ??= shooting(ctx, request);
      streak.update({ ...update, p: progress });
    },
    dispose() {
      streak?.dispose();
      first.dispose();
    },
  };
}

/** A white-gold flash and one ring of dust where the star stood. With motion off the flash alone plays. */
function supernova(ctx: Context): Effect3D {
  const { scene, kit, camera } = ctx;
  const own: Own = (resource) => kit.owned.own(resource);
  const group = new Group();
  scene.add(group);
  const flash = flashMesh(own, NOVA_FLASH);
  const ring = shellMesh(own, NOVA_RING);
  group.add(flash, ring);
  return {
    update({ p, from, still }) {
      const q = novaProgress(p);
      group.visible = q !== null;
      if (q === null) return;
      group.position.copy(vec(from.x, from.y, from.z));
      const r = worldRadius(DEPARTED_MAG, from.z, camera);
      const look = novaLook(q);
      flash.scale.setScalar(r * look.flashRadius);
      flash.material.opacity = look.flashAlpha;
      ring.visible = !still;
      ring.scale.setScalar(r * look.ringRadius);
      ring.material.uniforms['opacity'].value = look.ringAlpha;
    },
    dispose() {
      kit.owned.release(group);
    },
  };
}

/**
 * A ring falls in on the star, which shrinks to a point and flashes once. With
 * motion off the core and the flash play, and the ring does not.
 */
function collapse(ctx: Context): Effect3D {
  const { scene, kit, camera } = ctx;
  const own: Own = (resource) => kit.owned.own(resource);
  const group = new Group();
  scene.add(group);
  const core = flashMesh(own, COLLAPSE_CORE);
  const ring = shellMesh(own, COLLAPSE_RING);
  const point = flashMesh(own, '#ffffff');
  group.add(core, ring, point);
  return {
    update({ p, from, still }) {
      const q = collapseProgress(p);
      group.visible = q !== null;
      if (q === null) return;
      group.position.copy(vec(from.x, from.y, from.z));
      const r = worldRadius(DEPARTED_MAG, from.z, camera);
      const look = collapseLook(q);
      core.scale.setScalar(r * look.coreRadius);
      core.material.opacity = look.coreAlpha;
      point.scale.setScalar(r * look.flashRadius);
      point.material.opacity = look.flashAlpha;
      ring.visible = !still;
      ring.scale.setScalar(r * look.ringRadius);
      ring.material.uniforms['opacity'].value = look.ringAlpha;
    },
    dispose() {
      kit.owned.release(group);
    },
  };
}

/**
 * The star cools to an ember where it stood, then sinks into the black hole.
 * With motion off the cooling alone plays.
 */
function sinking(ctx: Context): Effect3D {
  const { scene, kit, camera } = ctx;
  const own: Own = (resource) => kit.owned.own(resource);
  const group = new Group();
  scene.add(group);
  const glow = flashMesh(own, '#ffffff');
  const halo = flashMesh(own, '#ffffff');
  group.add(halo, glow);
  const show = (
    at: { x: number; y: number; z: number },
    look: EmberLook,
    onHead: NewsEffect3D['onHead'],
  ): void => {
    group.visible = true;
    group.position.copy(vec(at.x, at.y, at.z));
    const r = worldRadius(DEPARTED_MAG, at.z, camera) * look.radius;
    for (const [mesh, size, share] of [
      [glow, 1, 1],
      [halo, 1.9, 0.22],
    ] as const) {
      mesh.material.color.set(look.colour).multiplyScalar(2);
      mesh.scale.setScalar(r * size);
      mesh.material.opacity = look.alpha * share;
    }
    onHead?.(ctx.toScreen(at.x, at.y, at.z));
  };
  return {
    update({ p, from, still, onHead }) {
      group.visible = false;
      const q = coolProgress(p);
      if (q !== null) {
        const look = coolLook(q);
        show(from, look, onHead);
        return;
      }
      const s = sinkProgress(p);
      if (still || s <= 0) return;
      const look = sinkLook(s);
      show(sinkHead(from, s), look, onHead);
    },
    dispose() {
      kit.owned.release(group);
    },
  };
}

/**
 * An exit with the review-thread sparks that peel off its star. The points are
 * built when the first spark flies, and each spark fades by dimming its colour.
 */
function withSparks(ctx: Context, exit: Effect3D): Effect3D {
  const { scene, kit } = ctx;
  let sparks: Points<BufferGeometry, PointsMaterial> | null = null;
  const build = (): Points<BufferGeometry, PointsMaterial> => {
    const geometry = kit.owned.own(new BufferGeometry());
    for (const name of ['position', 'color']) {
      geometry.setAttribute(name, new Float32BufferAttribute(new Array(MAX_SPARKS * 3).fill(0), 3));
    }
    const material = kit.owned.own(
      new PointsMaterial({
        size: 3.5,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    roundPoints(material);
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    return points;
  };
  return {
    update(request) {
      exit.update(request);
      const flying = request.sparks ?? [];
      if (!flying.length && !sparks) return;
      sparks ??= build();
      const position = sparks.geometry.attributes['position'];
      const colour = sparks.geometry.attributes['color'];
      const shown = Math.min(flying.length, MAX_SPARKS);
      for (let i = 0; i < shown; i++) {
        const spark = flying[i];
        const ink = new Color(sparkColour(spark.unresolved)).multiplyScalar(spark.alpha * 2);
        position.setXYZ(i, spark.x, -spark.y, spark.z);
        colour.setXYZ(i, ink.r, ink.g, ink.b);
      }
      position.needsUpdate = true;
      colour.needsUpdate = true;
      sparks.geometry.setDrawRange(0, shown);
    },
    dispose() {
      if (sparks) kit.owned.release(sparks);
      exit.dispose();
    },
  };
}

/** Builds each burst as it starts, plays it, and releases it once it ends. */
export class NewsEffects3D {
  private readonly playing = new Map<object, Effect3D>();

  constructor(private readonly ctx: Context) {}

  update(requests: readonly NewsEffect3D[]): void {
    const active = new Set<object>();
    for (const request of requests) {
      active.add(request.key);
      let effect = this.playing.get(request.key);
      if (!effect) {
        effect = this.build(request);
        this.playing.set(request.key, effect);
      }
      effect.update(request);
    }
    for (const [key, effect] of this.playing) {
      if (active.has(key)) continue;
      effect.dispose();
      this.playing.delete(key);
    }
  }

  private build(request: NewsEffect3D): Effect3D {
    if (request.mode === 'shooting') return shooting(this.ctx, request);
    if (request.mode === 'merged') {
      const exit = thenStreak(this.ctx, request, supernova(this.ctx), streakProgress);
      return withSparks(this.ctx, exit);
    }
    if (request.mode === 'squashed') {
      const exit = thenStreak(this.ctx, request, collapse(this.ctx), squashStreakProgress);
      return withSparks(this.ctx, exit);
    }
    if (request.mode === 'closed') return withSparks(this.ctx, sinking(this.ctx));
    return expanding(this.ctx, request);
  }

  dispose(): void {
    for (const effect of this.playing.values()) effect.dispose();
    this.playing.clear();
  }
}
