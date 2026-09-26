import { CameraController, clampScale } from './camera-controller';
import { CanvasSkyRenderer } from './canvas-sky';
import { Chart, SkyFrame, SkyLayer, SkyRenderer } from './sky-frame';
import { SkyLayout, buildField, carryOver } from './sky-layout';
import { FieldStar, SkyCluster, SkyStar, WORLD } from './sky-model';

/** The time a still sky is frozen at: a moment where the drift reads well. */
const STILL_T = 6.2;
/** The 3D camera's distance, which also sets how depth projects. */
const CAMERA_DISTANCE = 4200;
const CLICK_SLOP = 5;
const WHEEL_ZOOM = 1.16;
const KEY_ZOOM = 1.2;
const KEY_PAN_PX = 90;
const MAX_PIXEL_RATIO = 2;
const FIT_PAD = 150;

/** The chrome a Fit keeps the sky clear of, in CSS pixels. */
export interface FitInsets {
  readonly top: number;
  readonly bottom: number;
  /** A panel down the right edge, on a wide screen. */
  readonly side: number;
}

/** What the engine needs from the page around it. */
export interface SkyHost {
  readonly document: Document;
  readonly canvas: HTMLCanvasElement;
  /** Whether ambient motion is off. */
  frozen(): boolean;
  /** Chrome to frame the sky between. */
  insets(): FitInsets;
  /** A star was clicked, or empty sky (null). */
  picked(star: SkyStar | null): void;
  /** Loads the 3D renderer; rejects if the browser cannot run it. */
  loadWebGL?(
    camera: CameraController,
    onLost: (lost: boolean) => void,
  ): Promise<SkyRenderer & { mount(): void }>;
  /** Told when a frame throws, once. */
  failed?(error: unknown): void;
}

/**
 * pr-starmap's star map engine: the state, the frame loop, arrivals and drift,
 * input, picking and Fit. Renderers draw what it holds; skies lay it out.
 */
export class SkyEngine {
  readonly camera: CameraController;
  private stars: SkyStar[] = [];
  private clusters: SkyCluster[] = [];
  private field: FieldStar[] = [];
  private bornAt = 0;
  private renderer: SkyRenderer;
  private webgl: SkyRenderer | null = null;
  private clock = 0;
  private lastFrame = 0;
  private looping = false;
  private disposed = false;
  private faulted = false;
  private drag: { id: number; x: number; y: number; moved: number } | null = null;
  private dragging = false;
  private pinch: number | null = null;
  private lastFit: { x: number; y: number; scale: number } | null = null;
  private readonly teardown: (() => void)[] = [];
  private readonly ctx: CanvasRenderingContext2D;

  chart: Chart = 'prs';
  filter: ((star: SkyStar) => boolean) | null = null;
  selected: SkyStar | null = null;
  fog = 0;
  layers: SkyLayer[] = [];
  hidden = false;

  constructor(private readonly host: SkyHost) {
    const ctx = host.canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas');
    this.ctx = ctx;
    this.camera = new CameraController(
      { x: WORLD.w / 2, y: WORLD.h / 2, scale: 0.5 },
      CAMERA_DISTANCE,
      () => this.size(),
    );
    this.renderer = this.canvasRenderer();
    this.field = buildField();
    this.listen();
    this.resize();
    void this.startWebGL();
  }

  get skyStars(): readonly SkyStar[] {
    return this.stars;
  }

  get skyClusters(): readonly SkyCluster[] {
    return this.clusters;
  }

  get rendererKind(): SkyRenderer['kind'] {
    return this.renderer.kind;
  }

  /** Lays the sky out again. With `carry`, stars already shown glide to their new places. */
  setSky(lay: (sky: SkyLayout) => void, { carry = false } = {}): void {
    const sky = new SkyLayout();
    lay(sky);
    this.bornAt = performance.now() / 1000;
    if (carry) carryOver(this.stars, sky.stars, this.bornAt);
    this.stars = sky.stars;
    this.clusters = sky.clusters;
    this.field = buildField();
    this.renderer.setScene(this.scene());
    if (this.webgl && this.webgl !== this.renderer) this.webgl.setScene(this.scene());
    this.kick();
  }

  /** When the last star finishes arriving, in wall seconds, so news can wait for it. */
  entranceEnd(): number {
    return this.bornAt + Math.max(0, ...this.stars.map((s) => s.delay)) + 0.9;
  }

  /** Whether ambient motion is off, as the page asked. */
  get frozen(): boolean {
    return this.host.frozen();
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.host.canvas.hidden = hidden;
    (this.webgl as { setHidden?(h: boolean): void } | null)?.setHidden?.(hidden);
    if (!hidden) this.kick();
  }

  /** Whether a star passes the legend's filter. */
  passes = (star: SkyStar): boolean => !this.filter || this.filter(star);

  zoomIn(): void {
    const { width, height } = this.size();
    this.zoomAt(width / 2, height / 2, KEY_ZOOM);
  }

  zoomOut(): void {
    const { width, height } = this.size();
    this.zoomAt(width / 2, height / 2, 1 / KEY_ZOOM);
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const { target } = this.camera;
    const { width, height } = this.size();
    const hit = this.pick(sx, sy);
    const z = this.renderer.kind === 'webgl' ? (hit?.az ?? 0) : 0;
    const depth = this.camera.depth(z);
    const [wx, wy] = this.camera.unproject(sx, sy, z);
    const next = clampScale(target.scale * factor);
    if (next === target.scale) return;
    target.scale = next;
    // Hold the point under the cursor, measured against the NEW scale.
    target.x = wx - (sx - width / 2) / (next * depth);
    target.y = wy - (sy - height / 2) / (next * depth);
    this.kick();
  }

  /** Frames every shown star between the chrome. */
  fit(): void {
    const { target } = this.camera;
    const shown = this.filter ? this.stars.filter(this.passes) : this.stars;
    if (!shown.length) {
      target.x = WORLD.w / 2;
      target.y = WORLD.h / 2;
      target.scale = 0.5;
      return this.kick();
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of shown) {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
    }
    const { width, height } = this.size();
    const { top, bottom, side } = this.host.insets();
    target.scale = clampScale(
      Math.min(
        (width - side) / (maxX - minX + FIT_PAD * 2),
        (height - top - bottom) / (maxY - minY + FIT_PAD * 2),
      ),
    );
    target.x = (minX + maxX) / 2 + side / 2 / target.scale;
    target.y = (minY + maxY) / 2 - (top - bottom) / 2 / target.scale;
    if (this.renderer.kind === 'webgl') {
      this.camera.frameBounds(shown, {
        left: 36,
        right: width - side - 36,
        top: top + 35,
        bottom: height - bottom - 45,
      });
    }
    this.lastFit = { ...target };
    this.kick();
  }

  /** Flies to a star and selects it, as a list row does. */
  goTo(star: SkyStar): void {
    const { target } = this.camera;
    target.x = star.x;
    target.y = star.y;
    target.scale = clampScale(1.5);
    this.kick();
  }

  pan(dx: number, dy: number): void {
    const step = KEY_PAN_PX / this.camera.current.scale;
    this.camera.target.x += dx * step;
    this.camera.target.y += dy * step;
    this.kick();
  }

  /** The nearest shown star within reach of a screen point. */
  pick(sx: number, sy: number): SkyStar | null {
    let best: SkyStar | null = null;
    let bestD = Infinity;
    const wall = performance.now() / 1000;
    const scale = this.camera.current.scale;
    for (const star of this.stars) {
      if (this.born(star, wall) < 0.1) continue;
      if (!this.passes(star)) continue;
      const [x, y] = this.renderer.toScreen(star.ax, star.ay, star.az);
      const d = Math.hypot(x - sx, y - sy);
      const reach = Math.max(star.mag * Math.max(scale, 0.42) * 1.8, 18);
      if (d < reach && d < bestD) {
        best = star;
        bestD = d;
      }
    }
    return best;
  }

  /** Where a world point is on screen, through the active renderer. */
  toScreen(x: number, y: number, z = 0): [number, number] {
    return this.renderer.toScreen(x, y, z);
  }

  kick(): void {
    if (this.looping || this.disposed) return;
    this.lastFrame = performance.now() / 1000;
    this.loop();
  }

  resize(): void {
    const window = this.host.document.defaultView;
    if (!window) return;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const { width, height } = this.size();
    const canvas = this.host.canvas;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.renderer.resize();
    this.kick();
  }

  dispose(): void {
    this.disposed = true;
    for (const undo of this.teardown) undo();
    this.webgl?.dispose();
  }

  /** 0 to 1 as a star arrives, eased. */
  private born(star: SkyStar, wall: number): number {
    if (this.host.frozen()) return 1;
    const p = (wall - this.bornAt - star.delay) / 0.9;
    return p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.pow(1 - p, 3);
  }

  private size(): { width: number; height: number } {
    const window = this.host.document.defaultView;
    return { width: window?.innerWidth ?? 0, height: window?.innerHeight ?? 0 };
  }

  private scene() {
    return { stars: this.stars, clusters: this.clusters, field: this.field };
  }

  private canvasRenderer(): SkyRenderer {
    return new CanvasSkyRenderer(
      this.host.document,
      () => this.size(),
      (x, y) => {
        const cam = this.camera.current;
        const { width, height } = this.size();
        return [(x - cam.x) * cam.scale + width / 2, (y - cam.y) * cam.scale + height / 2];
      },
    );
  }

  private async startWebGL(): Promise<void> {
    if (!this.host.loadWebGL) return;
    try {
      const webgl = await this.host.loadWebGL(this.camera, (lost) => {
        this.renderer = lost ? this.canvasRenderer() : webgl;
        this.kick();
      });
      if (this.disposed) return webgl.dispose();
      webgl.mount();
      (webgl as { setHidden?(h: boolean): void }).setHidden?.(this.hidden);
      this.webgl = webgl;
      this.renderer = webgl;
      webgl.setScene(this.scene());
      // A Fit made before 3D arrived framed a flat sky; frame again unless the viewer moved.
      const { target } = this.camera;
      if (
        this.lastFit &&
        (['x', 'y', 'scale'] as const).every((k) => this.lastFit?.[k] === target[k])
      ) {
        this.fit();
      }
      this.kick();
    } catch (error) {
      // CDN, context creation and shader failures all leave a working 2D sky.
      this.fallBackTo2D();
      this.host.failed?.(error);
    }
  }

  /** Swap to 2D before tearing 3D down, so a dispose that throws cannot leave a broken renderer. */
  private fallBackTo2D(): void {
    const failed = this.webgl;
    this.webgl = null;
    this.renderer = this.canvasRenderer();
    this.renderer.setScene(this.scene());
    try {
      failed?.dispose();
    } catch {
      // The context may already be gone.
    }
    this.kick();
  }

  private loop = (): void => {
    const document = this.host.document;
    if (document.hidden || this.hidden || this.disposed) {
      this.looping = false;
      return;
    }
    this.looping = true;
    try {
      this.draw();
    } catch (error) {
      if (this.renderer.kind === 'webgl') {
        this.fallBackTo2D();
      } else if (!this.faulted) {
        this.faulted = true;
        this.host.failed?.(error);
      }
    }
    // A frozen sky still eases the camera, so panning and zooming stay smooth.
    if (this.host.frozen() && this.camera.settled()) {
      this.looping = false;
      return;
    }
    document.defaultView?.requestAnimationFrame(this.loop);
  };

  private draw(): void {
    const wall = performance.now() / 1000;
    const dt = Math.min(wall - this.lastFrame, 0.05);
    this.lastFrame = wall;
    const frozen = this.host.frozen();
    if (!frozen) this.clock += dt;
    const t = frozen ? STILL_T : this.clock;

    this.camera.chase(dt, this.dragging);
    for (const s of this.stars) this.drift(s, t, wall, frozen);

    const ctx = this.ctx;
    const ratio = Math.min(this.host.document.defaultView?.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const { width, height } = this.size();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.clearRect(0, 0, width, height);
    this.renderer.frame(this.frame(t, wall, frozen));
  }

  private drift(s: SkyStar, t: number, wall: number, frozen: boolean): void {
    if (frozen) {
      s.ax = s.x;
      s.ay = s.y;
      s.az = s.z;
      return;
    }
    // A carried star glides from its old place to its new one.
    let bx = s.x;
    let by = s.y;
    s.az = s.z;
    if (s.moveAt != null && s.fromX != null && s.fromY != null && s.fromZ != null) {
      const p = Math.min(1, (wall - s.moveAt) / 1.1);
      const e = 1 - Math.pow(1 - p, 3);
      bx = s.fromX + (s.x - s.fromX) * e;
      by = s.fromY + (s.y - s.fromY) * e;
      s.az = s.fromZ + (s.z - s.fromZ) * e;
      if (p >= 1) s.moveAt = null;
    }
    s.ax = bx + Math.sin(t * s.driftRate1 + s.driftA) * s.driftRadius;
    s.ay = by + Math.cos(t * s.driftRate2 + s.driftB) * s.driftRadius * 0.78;
  }

  private frame(t: number, wall: number, frozen: boolean): SkyFrame {
    const { width, height } = this.size();
    const dim = (s: SkyStar): number => (this.passes(s) ? 1 : 0.1);
    return {
      ctx: this.ctx,
      width,
      height,
      camera: this.camera,
      t,
      wall,
      frozen,
      chart: this.chart,
      stars: this.stars,
      clusters: this.clusters,
      field: this.field,
      selected: this.selected,
      fog: this.fog,
      layers: this.layers,
      renderer: this.renderer.kind,
      born: (star) => this.born(star, wall),
      passes: this.passes,
      dim,
      dimCluster: (c) =>
        c.arm
          ? c.stars.some(this.passes)
            ? 1
            : 0.1
          : !this.filter || c.stars.some(this.passes)
            ? 1
            : 0.1,
      toScreen: (x, y, z) => this.renderer.toScreen(x, y, z),
    };
  }

  private listen(): void {
    const canvas = this.host.canvas;
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ): void => {
      canvas.addEventListener(type, handler, options);
      this.teardown.push(() => canvas.removeEventListener(type, handler));
    };
    const { target, velocity } = this.camera;
    on('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      this.dragging = true;
      velocity.x = 0;
      velocity.y = 0;
      canvas.classList.add('dragging');
      this.kick();
    });
    on('pointermove', (e) => {
      const drag = this.drag;
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      // Drag changes only the target; the camera always chases.
      target.x -= dx / this.camera.current.scale;
      target.y -= dy / this.camera.current.scale;
      velocity.x = -dx;
      velocity.y = -dy;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.kick();
    });
    on('pointerup', (e) => {
      canvas.classList.remove('dragging');
      this.dragging = false;
      const wasClick = this.drag !== null && this.drag.moved < CLICK_SLOP;
      this.drag = null;
      if (wasClick) {
        velocity.x = 0;
        velocity.y = 0;
        this.host.picked(this.pick(e.clientX, e.clientY));
      }
      this.kick();
    });
    on('pointercancel', () => {
      this.drag = null;
      this.dragging = false;
      canvas.classList.remove('dragging');
    });
    on(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM);
      },
      { passive: false },
    );
    on(
      'touchmove',
      (e) => {
        if (e.touches.length !== 2) return;
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (this.pinch)
          this.zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, d / this.pinch);
        this.pinch = d;
      },
      { passive: false },
    );
    on('touchend', () => (this.pinch = null));
    const window = this.host.document.defaultView;
    const resize = (): void => this.resize();
    const visible = (): void => {
      if (!this.host.document.hidden) this.kick();
    };
    window?.addEventListener('resize', resize);
    this.host.document.addEventListener('visibilitychange', visible);
    this.teardown.push(() => {
      window?.removeEventListener('resize', resize);
      this.host.document.removeEventListener('visibilitychange', visible);
    });
  }
}
