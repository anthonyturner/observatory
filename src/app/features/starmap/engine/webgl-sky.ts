import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Material,
  PerspectiveCamera,
  Points,
  ReinhardToneMapping,
  Scene,
  ShaderMaterial,
  Sprite,
  Texture,
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
import { NewsEffects3D } from './news-3d';
import {
  drawClusterLabel,
  drawFog,
  drawGrid,
  drawMass,
  drawReticle,
  drawStarLabel,
  starRadius,
} from './canvas-sky';
import { rnd } from './rnd';
import { SkyFrame, SkyRenderer, SkyScene } from './sky-frame';
import { FieldStar, SkyStar } from './sky-model';

/* pr-starmap's WebGL sky: a perspective camera over the same world, bloom on
   the luminous cores only, a vignette and grain pass, a nebula of cloud
   sprites at depth. Words and marks are drawn over it by the 2D overlay. */

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

function buildScene3D(
  scene: Scene,
  kit: Kit,
  camera: CameraController,
  data: SkyScene,
): SceneModel {
  const { owned } = kit;
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

  const maps = new Map<string, Texture>();
  const starMap = (colour: string): Texture => {
    const known = maps.get(colour);
    if (known) return known;
    const map = kit.texture((c) => {
      const r = 14;
      const mid = 64;
      const glow = r * 3.4;
      const g = c.createRadialGradient(mid, mid, 0, mid, mid, glow);
      g.addColorStop(0, colour);
      g.addColorStop(0.3, colour + '80');
      g.addColorStop(1, colour + '00');
      c.globalAlpha = 0.5;
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      c.globalAlpha = 0.55;
      c.lineWidth = r * 0.11;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const len = r * 4;
        const lg = c.createLinearGradient(
          mid - dx * len,
          mid - dy * len,
          mid + dx * len,
          mid + dy * len,
        );
        lg.addColorStop(0, colour + '00');
        lg.addColorStop(0.5, colour);
        lg.addColorStop(1, colour + '00');
        c.strokeStyle = lg;
        c.beginPath();
        c.moveTo(mid - dx * len, mid - dy * len);
        c.lineTo(mid + dx * len, mid + dy * len);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = colour;
      c.beginPath();
      c.arc(mid, mid, r * 0.46, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(mid, mid, r * 0.21, 0, Math.PI * 2);
      c.fill();
    });
    maps.set(colour, map);
    return map;
  };

  const circle = Array.from({ length: 65 }, (_, i) =>
    vec(Math.cos((i / 64) * Math.PI * 2), Math.sin((i / 64) * Math.PI * 2)),
  );
  const points = data.stars
    .filter((star) => !star.custom)
    .map((star) => {
      const body = kit.sprite(starMap(star.colour));
      scene.add(body);
      const pulse = kit.line(circle, star.colour, 0.3);
      scene.add(pulse);
      return { star, body, pulse };
    });
  const connections = data.clusters
    .filter((c) => c.stars.length > 1 && !c.arm)
    .map((cluster) => {
      const object = kit.line(
        cluster.stars.map((s) => vec(s.ax, s.ay, s.az)),
        cluster.colour,
        0.35,
      );
      scene.add(object);
      return { cluster, object };
    });
  const route = data.clusters.flatMap((c) =>
    c.stars.length ? [c.stars[0], c.stars[c.stars.length - 1]] : [],
  );
  const flow = kit.line(
    route.map((s) => vec(s.ax, s.ay, s.az)),
    '#8ea2ff',
    0.5,
    true,
  );
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

  const updateLine = (object: Line, members: readonly SkyStar[]): void => {
    const p = object.geometry.attributes['position'];
    members.forEach((s, i) => p.setXYZ(i, s.ax, -s.ay, s.az));
    p.needsUpdate = true;
    object.geometry.computeBoundingSphere();
  };

  return {
    update(f: SkyFrame): void {
      const { t } = f;
      const cam = f.camera.current;
      updateField(t, Math.min(globalThis.devicePixelRatio || 1, 1.25));
      for (const { cloud, x, y, z, phase } of clouds) {
        cloud.position.copy(vec(x + Math.sin(t * 0.035 + phase) * 50, y, z));
      }
      for (const { star, body, pulse } of points) {
        const grow = f.born(star);
        const tw =
          0.78 +
          Math.sin(t * star.twinkleRate + star.twinkle) * 0.16 +
          Math.sin(t * star.twinkleRate * 2.7 + star.twinkle * 1.7) * 0.07;
        const r = star.mag * Math.max(cam.scale, 0.42) * grow;
        // Magnitude is data: cancel perspective shrinkage at each sprite's depth.
        const unit = 1 / (cam.scale * camera.depth(star.az));
        body.position.copy(vec(star.ax, star.ay, star.az));
        body.scale.setScalar(r * (128 / 14) * unit);
        body.material.opacity = f.dim(star) * grow * (0.7 + tw * 0.3);
        const phase = (t * 0.42 + star.spin) % 1;
        pulse.visible = star.urgent && !f.frozen;
        pulse.position.copy(body.position);
        pulse.scale.setScalar(r * (1.4 + phase * 4.2) * unit);
        (pulse.material as LineBasicMaterial).opacity = f.dim(star) * grow * (1 - phase) * 0.34;
      }
      for (const { object, cluster } of connections) {
        updateLine(object, cluster.stars);
        (object.material as LineBasicMaterial).opacity =
          (0.42 + Math.sin(t * 0.62 + cluster.cx * 0.004) * 0.13) * f.dimCluster(cluster);
      }
      flow.visible = f.chart === 'prs' && route.length > 1;
      if (route.length) {
        updateLine(flow, route);
        flow.computeLineDistances();
      }
      (flow.material as LineDashedMaterial).scale = cam.scale;
      dashTime.value = t * 30;
      news.update(f.layers.flatMap((layer) => layer.effects3D?.(f) ?? []));
    },
    dispose(): void {
      news.dispose();
    },
  };
}

/** Marks that annotate the sky rather than model it stay in screen space,
 *  projected through each star's depth so they still land on it. */
function drawOverlay(f: SkyFrame): void {
  drawGrid(f);
  const { ctx } = f;
  for (const layer of f.layers) layer.beneath?.(ctx, f);
  if (f.chart === 'prs') {
    for (const s of f.stars) {
      const grow = f.born(s);
      if (!s.cost || grow <= 0) continue;
      const [x, y] = f.toScreen(s.ax, s.ay, s.az);
      drawMass(f, s, x, y, starRadius(f, s, grow), f.dim(s) * grow, ctx);
    }
  }
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
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.6, 0.55, 0.7);
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
