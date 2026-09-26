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
import { CameraController } from './camera-controller';
import { Kit, vec } from './gpu-kit';
import { rnd } from './rnd';
import { NewsEffect3D } from './sky-frame';
import { SkyStar } from './sky-model';

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

/** The size a star is drawn at, in world units at its depth. */
const worldRadius = (star: SkyStar, camera: CameraController): number => {
  const scale = camera.current.scale;
  return (star.mag * Math.max(scale, 0.42)) / (scale * camera.depth(star.az));
};

function expanding(ctx: Context, request: NewsEffect3D): Effect3D {
  const { scene, kit, camera } = ctx;
  const own = <T extends { dispose(): void }>(resource: T): T => kit.owned.own(resource);
  const mode = request.mode as 'nova' | 'supernova' | 'implode';
  const group = new Group();
  scene.add(group);
  const colour = mode === 'nova' ? '#ffffff' : mode === 'implode' ? '#5fe3a1' : request.colour;
  const flash = new Mesh(
    own(new SphereGeometry(1, 20, 12)),
    own(
      new MeshBasicMaterial({
        color: new Color('#ffffff').multiplyScalar(2),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    ),
  );
  group.add(flash);
  const shells = Array.from({ length: mode === 'implode' ? 3 : mode === 'nova' ? 1 : 2 }, () => {
    const material = own(
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
    );
    const shell = new Mesh(own(new SphereGeometry(1, 24, 16)), material);
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
  debris.material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nif (length(gl_PointCoord - vec2(.5)) > .5) discard;',
    );
  };
  group.add(debris);
  return {
    update({ p, star }) {
      if (!star) return;
      group.position.copy(vec(star.ax, star.ay, star.az));
      const r = worldRadius(star, camera);
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
      const travel = 620 * ease(p);
      const tail = 170 * (1 - p * 0.4);
      const attr = streak.geometry.attributes['position'];
      for (let i = 0; i < STREAK_POINTS; i++) {
        const d = travel - tail * (1 - i / (STREAK_POINTS - 1));
        attr.setXYZ(
          i,
          from.x + Math.cos(angle) * d,
          -(from.y + Math.sin(angle) * d),
          from.z + d * 0.32,
        );
      }
      attr.needsUpdate = true;
      streak.geometry.computeBoundingSphere();
      material.opacity = 1 - p ** 3;
      onHead?.(
        ctx.toScreen(
          from.x + Math.cos(angle) * travel,
          from.y + Math.sin(angle) * travel,
          from.z + travel * 0.32,
        ),
      );
    },
    dispose() {
      kit.owned.release(streak);
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
        effect =
          request.mode === 'shooting' ? shooting(this.ctx, request) : expanding(this.ctx, request);
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

  dispose(): void {
    for (const effect of this.playing.values()) effect.dispose();
    this.playing.clear();
  }
}
