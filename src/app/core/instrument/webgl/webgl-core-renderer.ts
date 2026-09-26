import {
  Color,
  PerspectiveCamera,
  ReinhardToneMapping,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ProjectSnapshot } from '../../projects/project.types';
import { CoreAnimator } from '../core-animator';
import { CoreFrame, CoreRenderer } from '../core-renderer';
import { CoreView } from '../core-view';
import { layerCanvas } from '../layer-canvas';
import { CorePalette, readPalette } from '../palette';
import { CAMERA_DEPTH } from '../proportions';
import { CoreScene } from './core-scene';

/** Sharper than this costs a phone's graphics card more than it shows. */
const MAX_PIXEL_RATIO = 1.25;
const EXPOSURE = 1.15;
/** Restraint: only the ball's dense centre, its heart and the beads' cores
 *  are bright enough to feed the bloom; lines and floor stay crisp. */
const BLOOM = { strength: 0.7, radius: 0.55, threshold: 0.7 } as const;
const FIELD_OF_VIEW = 30;

/* The page shows through: each pixel's alpha is its brightness, and the
   canvas is premultiplied, so the core adds its light over the sky rather
   than painting black round it. */
const SEE_THROUGH = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader:
    'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0., 1.)); }`,
};

/** The core drawn with WebGL through three.js: the full-count ball, bloom, and glowing beads. */
export class WebGLCoreRenderer implements CoreRenderer {
  private gl: WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private palette: CorePalette | null = null;
  private model: CoreScene | null = null;
  private view: CoreView | null = null;
  private projects: readonly ProjectSnapshot[] = [];
  private isContextLost = false;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 10, CAMERA_DEPTH * 4);
  private readonly animator = new CoreAnimator();
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.isContextLost = true;
  };

  mount(host: HTMLElement): void {
    const canvas = layerCanvas(host);
    try {
      this.gl = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
    } catch {
      // No WebGL here: canDraw() says so, and the caller keeps the 2D core.
      canvas.remove();
      return;
    }
    this.gl.setClearColor(new Color(0, 0, 0), 0);
    this.gl.toneMapping = ReinhardToneMapping;
    this.gl.toneMappingExposure = EXPOSURE;
    this.gl.debug.onShaderError = () => {
      throw new Error('A core shader did not compile.');
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.palette = readPalette(host);
    this.composer = this.buildComposer(this.gl);
  }

  canDraw(): boolean {
    return this.gl !== null && !this.isContextLost;
  }

  setProjects(projects: readonly ProjectSnapshot[]): void {
    this.projects = projects;
    this.rebuild();
  }

  setView(view: CoreView): void {
    const previous = this.view;
    this.view = view;
    if (view.width !== previous?.width || view.height !== previous?.height) this.resize(view);
    if (!previous || CoreScene.shapeKey(view) !== CoreScene.shapeKey(previous)) this.rebuild();
  }

  frame(frame: CoreFrame): void {
    if (this.isContextLost) throw new Error('The WebGL context was lost.');
    const { composer, palette, model, view } = this;
    if (!composer || !palette || !model || !view) return;
    this.animator.advance(frame, palette.inks);
    const pose = this.animator.pose;
    if (!pose) return;
    model.update({ pose, view, pixelRatio: this.pixelRatio(view) });
    composer.render();
  }

  dispose(): void {
    this.model?.dispose();
    this.model = null;
    this.composer?.passes.forEach((pass) => pass.dispose());
    this.composer?.dispose();
    const canvas = this.gl?.domElement;
    canvas?.removeEventListener('webglcontextlost', this.onContextLost);
    this.gl?.dispose();
    canvas?.remove();
    this.gl = null;
    this.composer = null;
  }

  private buildComposer(gl: WebGLRenderer): EffectComposer {
    const composer = new EffectComposer(gl);
    this.bloom = new UnrealBloomPass(
      new Vector2(1, 1),
      BLOOM.strength,
      BLOOM.radius,
      BLOOM.threshold,
    );
    composer.addPass(new RenderPass(this.scene, this.camera));
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(SEE_THROUGH));
    return composer;
  }

  /** A camera CAMERA_DEPTH away, with the field of view that makes one unit
   *  one pixel on the plane the core sits in: the same lens as the 2D core's. */
  private resize(view: CoreView): void {
    const ratio = this.pixelRatio(view);
    this.gl?.setPixelRatio(ratio);
    this.gl?.setSize(view.width, view.height, false);
    this.composer?.setPixelRatio(ratio);
    this.composer?.setSize(view.width, view.height);
    this.camera.aspect = view.width / view.height;
    this.camera.fov = (2 * Math.atan(view.height / (2 * CAMERA_DEPTH)) * 180) / Math.PI;
    this.camera.position.set(view.width / 2, -view.height / 2, CAMERA_DEPTH);
    this.camera.updateProjectionMatrix();
  }

  private pixelRatio(view: CoreView): number {
    return Math.min(view.pixelRatio, MAX_PIXEL_RATIO);
  }

  private rebuild(): void {
    if (!this.gl || !this.palette || !this.view) return;
    this.model?.dispose();
    this.model = new CoreScene({ view: this.view, projects: this.projects, palette: this.palette });
    this.scene.clear();
    this.scene.add(this.model.group);
  }
}
