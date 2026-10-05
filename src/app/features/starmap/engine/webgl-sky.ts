import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Material,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  Points,
  ReinhardToneMapping,
  Scene,
  ShaderMaterial,
  Sprite,
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CameraController } from './camera-controller';
import { Kit, Owned, vec } from './gpu-kit';
import { FLOW_INK, LINK_GAP, LINK_INK, trimSegment } from './link-ink';
import { NewsEffects3D } from './news-3d';
import { Threads3D } from './threads-3d';
import {
  drawClusterLabel,
  drawFog,
  drawGrid,
  drawReticle,
  drawStarLabel,
  starRadius,
} from './canvas-sky';
import { rnd } from './rnd';
import { SkyFrame, SkyRenderer, SkyScene } from './sky-frame';
import { FieldStar, SkyStar } from './sky-model';
import {
  STAR_FRAGMENT,
  STAR_QUAD_REACH,
  STAR_TYPES,
  STAR_VERTEX,
} from '../../../shared/gl/star-shader';
import { starLook } from './star-type';
import { GALAXY_FRAGMENT, GALAXY_VERTEX } from './galaxy-shader';
import { galaxyUniforms, galaxyView } from './galaxy-geometry';
import { IssuePlanet, PLANET_TONE_COUNT, issuePlanets, massOf, systemTurn } from './star-system';
import {
  DISC_FRAGMENT,
  DISC_QUAD_MARGIN,
  PLANET_FRAGMENT,
  PLANET_VERTEX,
  QUAD_VERTEX,
  SYSTEM_TILT,
} from './star-system-shaders';

/* pr-starmap's WebGL sky: a perspective camera over the same world, bloom on
   the luminous cores only, a vignette and grain pass, a nebula of cloud
   sprites at depth. Words and marks are drawn over it by the 2D overlay. */

/* A star's drawn disc, as a share of starRadius. Far off it is the old small
   core; close up it grows into the gap the links leave, so the surface shows,
   without changing starRadius itself, which the link gaps are measured from. */
const FAR_DISC = 0.46;
const NEAR_DISC = 0.75;
/** The on-screen core radius, in pixels, over which surface detail fades in. */
const FAR_CORE_PX = 2.5;
const NEAR_CORE_PX = 8;

/** Planets' tones: bare rock, dust, and a world with water. */
const PLANET_TONES = ['#9aa3ad', '#b59a78', '#7fa9a6'];
/** A planet is never smaller than this many screen pixels across. */
const MIN_PLANET_PX = 1.2;
/** The disc of gas starts this far out from the star's drawn disc. */
const DISC_CLEARANCE = 1.3;

const smoothstep = (from: number, to: number, x: number): number => {
  const k = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return k * k * (3 - 2 * k);
};

/** A single GPU draw for hundreds of stars, spread through an actual volume. */
function field3D(
  scene: Scene,
  owned: Owned,
  field: readonly FieldStar[],
): (t: number, ratio: number) => void {
  const positions: number[] = [];
  const colours: number[] = [];
  const sizes: number[] = [];
  const phases: number[] = [];
  for (const s of field) {
    positions.push(s.x, -s.y, s.z);
    const col = new Color(s.tint).multiplyScalar(s.a);
    colours.push(col.r, col.g, col.b);
    sizes.push(s.r);
    phases.push(s.phase, s.rate);
  }
  const geometry = owned.own(new BufferGeometry());
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('phase', new Float32BufferAttribute(phases, 2));
  const material = owned.own(
    new ShaderMaterial({
      uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
      vertexShader: `attribute vec3 color; attribute float size; attribute vec2 phase;
        uniform float time; uniform float pixelRatio; varying vec3 ink;
        void main() { float tw = .62 + .38 * sin(time * phase.y + phase.x);
          ink = color * tw; vec4 p = modelViewMatrix * vec4(position,1.);
          gl_Position = projectionMatrix * p; gl_PointSize = (1. + size * 2.) * pixelRatio; }`,
      fragmentShader: `varying vec3 ink; void main() { float r = length(gl_PointCoord - .5) * 2.;
        if (r > 1.) discard; gl_FragColor = vec4(ink, (1. - smoothstep(.1,1.,r))); }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  scene.add(new Points(geometry, material));
  return (t, ratio) => {
    material.uniforms['time'].value = t;
    material.uniforms['pixelRatio'].value = ratio;
  };
}

interface SceneModel {
  update(f: SkyFrame): void;
  dispose(): void;
}

/** A spiral galaxy behind everything: a full-screen layer at the far plane. */
function galaxy3D(scene: Scene, owned: Owned): (f: SkyFrame) => void {
  const material = owned.own(
    new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        aspect: { value: 1 },
        zoom: { value: 1 },
        spin: { value: 0 },
        drift: { value: new Vector2() },
      },
      vertexShader: GALAXY_VERTEX,
      fragmentShader: GALAXY_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const sky = new Mesh(owned.own(new PlaneGeometry(2, 2)), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  return (f) => {
    const t = f.frozen ? 0 : f.t;
    const { aspect, zoom, spin, driftX, driftY } = galaxyUniforms(galaxyView(f));
    material.uniforms['time'].value = t;
    material.uniforms['aspect'].value = aspect;
    material.uniforms['zoom'].value = zoom;
    material.uniforms['spin'].value = spin;
    material.uniforms['drift'].value.set(driftX, driftY);
  };
}

function buildScene3D(
  scene: Scene,
  kit: Kit,
  camera: CameraController,
  data: SkyScene,
): SceneModel {
  const { owned } = kit;
  const updateGalaxy = galaxy3D(scene, owned);
  const updateField = field3D(scene, owned, data.field);
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

  const quad = owned.own(new PlaneGeometry(1, 1));
  const starQuad = (star: SkyStar): Mesh<PlaneGeometry, ShaderMaterial> => {
    const look = starLook(star);
    const material = owned.own(
      new ShaderMaterial({
        uniforms: {
          ink: { value: new Color(star.colour) },
          type: { value: STAR_TYPES.indexOf(look.type) },
          activity: { value: look.activity },
          seed: { value: (star.spin * 97) % 61 },
          time: { value: 0 },
          detail: { value: 0 },
          opacity: { value: 0 },
          disc: { value: FAR_DISC },
        },
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    return new Mesh(quad, material);
  };

  const discFor = (star: SkyStar): Mesh<PlaneGeometry, ShaderMaterial> | null => {
    const mass = massOf(star);
    if (!mass) return null;
    const disc = new Mesh(
      quad,
      owned.own(
        new ShaderMaterial({
          uniforms: {
            ink: { value: new Color(mass.colour) },
            weight: { value: mass.weight },
            seed: { value: (star.spin * 53) % 41 },
            time: { value: 0 },
            turn: { value: 0 },
            inner: { value: 0.2 },
            star: { value: 0.1 },
            detail: { value: 0 },
            opacity: { value: 0 },
          },
          vertexShader: QUAD_VERTEX,
          fragmentShader: DISC_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      ),
    );
    scene.add(disc);
    return disc;
  };
  const ball = owned.own(new SphereGeometry(1, 16, 12));
  const tones = PLANET_TONES.slice(0, PLANET_TONE_COUNT).map((hex) => new Color(hex));
  const planetsFor = (
    star: SkyStar,
  ): { planet: IssuePlanet; mesh: Mesh<SphereGeometry, ShaderMaterial> }[] =>
    issuePlanets(star).map((planet) => {
      const mesh = new Mesh(
        ball,
        owned.own(
          new ShaderMaterial({
            uniforms: {
              tone: { value: tones[planet.tone] },
              star: { value: vec(star.ax, star.ay, star.az) },
              opacity: { value: 0 },
            },
            vertexShader: PLANET_VERTEX,
            fragmentShader: PLANET_FRAGMENT,
            transparent: true,
          }),
        ),
      );
      scene.add(mesh);
      return { planet, mesh };
    });

  const circle = Array.from({ length: 65 }, (_, i) =>
    vec(Math.cos((i / 64) * Math.PI * 2), Math.sin((i / 64) * Math.PI * 2)),
  );
  const points = data.stars
    .filter((star) => !star.custom)
    .map((star) => {
      const body = starQuad(star);
      scene.add(body);
      const pulse = kit.line(circle, star.colour, 0.3);
      scene.add(pulse);
      return { star, body, pulse, disc: discFor(star), planets: planetsFor(star) };
    });
  const connections = data.clusters
    .filter((c) => c.stars.length > 1 && !c.arm)
    .map((cluster) => {
      const object = kit.segments(
        cluster.stars.slice(1).flatMap(() => [vec(0, 0), vec(0, 0)]),
        LINK_INK,
        0.5,
      );
      scene.add(object);
      return { cluster, object };
    });
  const route = data.clusters.flatMap((c) =>
    c.stars.length ? [c.stars[0], c.stars[c.stars.length - 1]] : [],
  );
  const flow = kit.line(
    route.map((s) => vec(s.ax, s.ay, s.az)),
    FLOW_INK,
    0.55,
    true,
  );
  Object.assign(flow.material, { dashSize: 1.5, gapSize: 7.5 });
  scene.add(flow);
  const dashTime = { value: 0 };
  (flow.material as Material).onBeforeCompile = (shader) => {
    shader.uniforms['dashTime'] = dashTime;
    shader.fragmentShader =
      'uniform float dashTime;\n' +
      shader.fragmentShader.replace(
        'mod( vLineDistance, totalSize )',
        'mod( vLineDistance - dashTime, totalSize )',
      );
  };

  const news = new NewsEffects3D({
    scene,
    kit,
    camera,
    toScreen: (x, y, z) => camera.project(x, y, z),
  });

  const threads = new Threads3D(scene, kit);

  const updateLine = (object: Line, members: readonly SkyStar[]): void => {
    const p = object.geometry.attributes['position'];
    members.forEach((s, i) => p.setXYZ(i, s.ax, -s.ay, s.az));
    p.needsUpdate = true;
    object.geometry.computeBoundingSphere();
  };

  /** Each segment of a constellation, stopped short of its stars by their
   *  on-screen gap carried back to each star's depth. */
  const updateSegments = (f: SkyFrame, object: LineSegments, members: readonly SkyStar[]): void => {
    const p = object.geometry.attributes['position'];
    const scale = f.camera.current.scale;
    const gap = (s: SkyStar): number =>
      (starRadius(f, s, f.born(s)) + LINK_GAP) / (scale * camera.depth(s.az));
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
  };

  return {
    update(f: SkyFrame): void {
      const { t } = f;
      const cam = f.camera.current;
      updateGalaxy(f);
      updateField(t, Math.min(globalThis.devicePixelRatio || 1, 1.25));
      for (const { cloud, x, y, z, phase } of clouds) {
        cloud.position.copy(vec(x + Math.sin(t * 0.035 + phase) * 50, y, z));
      }
      for (const { star, body, pulse, disc, planets } of points) {
        const grow = f.born(star);
        const tw =
          0.78 +
          Math.sin(t * star.twinkleRate + star.twinkle) * 0.16 +
          Math.sin(t * star.twinkleRate * 2.7 + star.twinkle * 1.7) * 0.07;
        const r = star.mag * Math.max(cam.scale, 0.42) * grow;
        // Magnitude is data: cancel perspective shrinkage at each sprite's depth.
        const unit = 1 / (cam.scale * camera.depth(star.az));
        body.position.copy(vec(star.ax, star.ay, star.az));
        body.scale.setScalar(r * STAR_QUAD_REACH * 2 * unit);
        const look = body.material.uniforms;
        const detail = smoothstep(FAR_CORE_PX, NEAR_CORE_PX, r * FAR_DISC);
        look['detail'].value = detail;
        look['disc'].value = FAR_DISC + (NEAR_DISC - FAR_DISC) * detail;
        look['time'].value = f.frozen ? 0 : t;
        look['opacity'].value = f.dim(star) * grow * (0.7 + tw * 0.3);
        const turn = systemTurn(star.spin, t, f.frozen);
        const drawn = look['disc'].value as number;
        if (disc) {
          const mass = massOf(star);
          const reach = (mass?.reach ?? 1) * r;
          const u = disc.material.uniforms;
          disc.visible = f.chart === 'prs' && grow > 0;
          disc.position.copy(body.position);
          disc.scale.setScalar(reach * DISC_QUAD_MARGIN * 2 * unit);
          u['turn'].value = turn;
          u['inner'].value = (drawn * DISC_CLEARANCE * r) / Math.max(reach, 0.001);
          u['star'].value = (drawn * r) / Math.max(reach, 0.001);
          u['time'].value = f.frozen ? 0 : t;
          u['detail'].value = detail;
          u['opacity'].value = f.dim(star) * grow;
        }
        for (const { planet, mesh } of planets) {
          // Each issue's world, in the disc's tilted plane, turned as the disc turns.
          const angle = planet.phase + (f.frozen ? 0 : t * planet.speed);
          const ox = Math.cos(angle) * planet.orbit * r;
          const oy = Math.sin(angle) * planet.orbit * r * SYSTEM_TILT;
          const sx = ox * Math.cos(turn) - oy * Math.sin(turn);
          const sy = ox * Math.sin(turn) + oy * Math.cos(turn);
          mesh.visible = detail > 0.02 && grow > 0;
          mesh.position.copy(
            vec(
              star.ax + sx * unit,
              star.ay + sy * unit,
              star.az + Math.sin(angle) * planet.orbit * r * unit,
            ),
          );
          mesh.scale.setScalar(Math.max(planet.size * r, MIN_PLANET_PX / 2) * unit);
          mesh.material.uniforms['star'].value.copy(body.position);
          mesh.material.uniforms['opacity'].value = f.dim(star) * grow * detail;
        }
        const phase = (t * 0.42 + star.spin) % 1;
        pulse.visible = star.urgent && !f.frozen;
        pulse.position.copy(body.position);
        pulse.scale.setScalar(r * (1.4 + phase * 4.2) * unit);
        (pulse.material as LineBasicMaterial).opacity = f.dim(star) * grow * (1 - phase) * 0.34;
      }
      for (const { object, cluster } of connections) {
        updateSegments(f, object, cluster.stars);
        (object.material as LineBasicMaterial).opacity =
          (0.5 + Math.sin(t * 0.62 + cluster.cx * 0.004) * 0.12) * f.dimCluster(cluster);
      }
      flow.visible = f.chart === 'prs' && route.length > 1;
      if (route.length) {
        updateLine(flow, route);
        flow.computeLineDistances();
      }
      (flow.material as LineDashedMaterial).scale = cam.scale;
      dashTime.value = t * 30;
      news.update(f.layers.flatMap((layer) => layer.effects3D?.(f) ?? []));
      // Log threads follow the same fault across windows, bowed in 3D.
      threads.update(
        f.layers.map((layer) => layer.threads3D?.(f) ?? null).find((each) => each !== null) ?? null,
        cam.scale,
      );
    },
    dispose(): void {
      news.dispose();
      threads.dispose();
    },
  };
}

/** Marks that annotate the sky rather than model it stay in screen space,
 *  projected through each star's depth so they still land on it. */
function drawOverlay(f: SkyFrame): void {
  drawGrid(f);
  const { ctx } = f;
  for (const layer of f.layers) layer.beneath?.(ctx, f);
  for (const layer of f.layers) layer.flat?.(ctx, f);
  for (const c of f.clusters) drawClusterLabel(f, c);
  if (f.camera.current.scale > 0.5) for (const s of f.stars) drawStarLabel(f, s);
  const selected = f.selected;
  if (selected && selected.kind !== 'comet') {
    const [x, y] = f.toScreen(selected.ax, selected.ay, selected.az);
    drawReticle(ctx, x, y, starRadius(f, selected, f.born(selected)) * 1.5 + 9, f.t);
  }
  for (const layer of f.layers) layer.above?.(ctx, f);
  for (const layer of f.layers) layer.labels?.(ctx, f);
  drawFog(f);
}

/** Thrown when the GPU cannot give the sky what it needs; the 2D sky takes over. */
export class SkyUnavailable extends Error {}

export class WebGLSkyRenderer implements SkyRenderer {
  readonly kind = 'webgl';
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera3d = new PerspectiveCamera(30, 1, 1, 100000);
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly output = new OutputPass();
  private readonly finish: ShaderPass;
  private readonly owned = new Owned();
  private readonly kit: Kit;
  private model: SceneModel | null = null;
  private lost = false;

  constructor(
    private readonly document: Document,
    private readonly host: HTMLElement,
    private readonly camera: CameraController,
    private readonly view: () => { readonly width: number; readonly height: number },
    /** Told when the context is lost or comes back, so the engine can swap renderers. */
    private readonly onLost: (lost: boolean) => void,
  ) {
    this.kit = new Kit(document, this.owned);
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none';
    this.gl = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.gl.setClearColor('#000000');
    this.gl.toneMapping = ReinhardToneMapping;
    this.gl.toneMappingExposure = 1.15;
    this.gl.debug.onShaderError = () => {
      throw new SkyUnavailable('Sky shader did not compile');
    };
    this.composer = new EffectComposer(this.gl);
    this.renderPass = new RenderPass(this.scene, this.camera3d);
    // Restraint: only luminous cores feed bloom, never the whole nebula.
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.4, 0.5, 0.75);
    this.finish = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
      vertexShader:
        'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
        void main() { vec3 c = texture2D(tDiffuse,vUv).rgb;
          float vignette = 1. - .72 * smoothstep(.2,.8,length(vUv-.5));
          float grain = fract(sin(dot(gl_FragCoord.xy + floor(time*24.),vec2(12.9898,78.233)))*43758.5453)-.5;
          gl_FragColor = vec4(max(vec3(0.),c*vignette+grain*.018),1.); }`,
    });
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
    this.composer.addPass(this.finish);
    this.canvas.addEventListener('webglcontextlost', this.lostContext);
    this.canvas.addEventListener('webglcontextrestored', this.restoredContext);
  }

  mount(): void {
    this.host.before(this.canvas);
    this.canvas.hidden = this.host.hidden;
    this.resize();
  }

  /** Hidden with the sky it draws, for the list view. */
  setHidden(hidden: boolean): void {
    this.canvas.hidden = hidden;
  }

  setScene(data: SkyScene): void {
    this.model?.dispose();
    this.scene.clear();
    this.owned.disposeAll();
    this.model = buildScene3D(this.scene, this.kit, this.camera, data);
    this.lastScene = data;
  }

  toScreen(x: number, y: number, z = 0): [number, number] {
    return this.camera.project(x, y, z);
  }

  resize(): void {
    const { width, height } = this.view();
    this.gl.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.gl.setSize(width, height);
    // Bloom is deliberately limited to CSS resolution on Retina displays.
    this.composer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.25));
    this.composer.setSize(width, height);
  }

  frame(f: SkyFrame): void {
    if (this.lost || !this.model) return;
    const cam = f.camera.current;
    const { width, height } = this.view();
    this.camera3d.aspect = width / height;
    this.camera3d.fov =
      (2 * Math.atan(height / (2 * this.camera.distance * cam.scale)) * 180) / Math.PI;
    this.camera3d.position.set(cam.x, -cam.y, this.camera.distance);
    this.camera3d.updateProjectionMatrix();
    this.camera3d.updateMatrixWorld();
    this.model.update(f);
    this.finish.uniforms['time'].value = f.t;
    this.composer.render();
    drawOverlay(f);
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.lostContext);
    this.canvas.removeEventListener('webglcontextrestored', this.restoredContext);
    this.owned.disposeAll();
    for (const pass of [this.renderPass, this.bloom, this.output, this.finish]) pass.dispose();
    this.composer.dispose();
    this.gl.dispose();
    this.canvas.remove();
  }

  private lastScene: SkyScene | null = null;

  private readonly lostContext = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
    this.canvas.style.visibility = 'hidden';
    this.onLost(true);
  };

  private readonly restoredContext = (): void => {
    this.lost = false;
    try {
      this.resize();
      if (this.lastScene) this.setScene(this.lastScene);
      this.canvas.style.visibility = '';
      this.onLost(false);
    } catch {
      this.lostContext(new Event('webglcontextlost'));
    }
  };
}
