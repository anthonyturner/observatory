import { PerspectiveCamera, ReinhardToneMapping, Scene, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { CameraController } from './camera-controller';
import { drawFog, drawGrid, drawLabels, drawReticle, starRadius } from './canvas-sky';
import { Kit, Owned } from './gpu-kit';
import { SceneModel, buildScene3D, sceneRatio } from './scene-3d';
import { SkyFrame, SkyRenderer, SkyScene } from './sky-frame';
import { FinishPass, SkyBloomPass } from './sky-passes';

/* pr-starmap's WebGL sky: a perspective camera over the same world, bloom on
   the luminous cores only, a vignette and grain pass, a nebula of cloud
   sprites at depth. Words and marks are drawn over it by the 2D overlay. */

/** Marks that annotate the sky rather than model it stay in screen space,
 *  projected through each star's depth so they still land on it. */
function drawOverlay(f: SkyFrame): void {
  drawGrid(f);
  const { ctx } = f;
  for (const layer of f.layers) layer.beneath?.(ctx, f);
  for (const layer of f.layers) layer.flat?.(ctx, f);
  drawLabels(f);
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
  private readonly bloom: SkyBloomPass;
  private readonly finish = new FinishPass();
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
    this.bloom = new SkyBloomPass(new Vector2(1, 1), 0.4, 0.5, 0.75);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
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

  /** The first scene builds the sky; each one after updates it in place. */
  setScene(data: SkyScene): void {
    this.model ??= buildScene3D(this.scene, this.kit, this.camera);
    this.model.load(data);
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
    this.composer.setPixelRatio(sceneRatio());
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
    this.model.update(f, this.gl);
    this.finish.time.value = f.t;
    this.composer.render();
    drawOverlay(f);
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.lostContext);
    this.canvas.removeEventListener('webglcontextrestored', this.restoredContext);
    this.owned.disposeAll();
    for (const pass of [this.renderPass, this.bloom, this.finish]) pass.dispose();
    this.composer.dispose();
    this.gl.dispose();
    this.canvas.remove();
  }

  private lastScene: SkyScene | null = null;

  private teardown(): void {
    this.model?.dispose();
    this.model = null;
    this.scene.clear();
    this.owned.disposeAll();
  }

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
      // The context's resources are gone, so the sky is built from nothing.
      this.teardown();
      if (this.lastScene) this.setScene(this.lastScene);
      this.canvas.style.visibility = '';
      this.onLost(false);
    } catch {
      this.lostContext(new Event('webglcontextlost'));
    }
  };
}
