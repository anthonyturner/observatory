import type { Butterchurn, ButterchurnOptions, ButterchurnVisualizer } from 'butterchurn';
import { LiveSound } from '../sources/audio-tap';
import { presetFor } from './milkdrop-presets';

/** Butterchurn and its presets, once loaded. */
export interface MilkdropEngine {
  createVisualizer(
    context: AudioContext,
    canvas: HTMLCanvasElement,
    options: ButterchurnOptions,
  ): ButterchurnVisualizer;
  readonly presets: Readonly<Record<string, object>>;
}

export type MilkdropLoader = () => Promise<MilkdropEngine>;

/** Butterchurn itself, whether or not the bundler unwrapped its default export. */
export function unwrapButterchurn(
  exported: Butterchurn | { readonly default: Butterchurn },
): Butterchurn {
  return 'createVisualizer' in exported ? exported : exported.default;
}

/** Loads Butterchurn on first use, in its own chunk: it is large, and most
 *  visits never listen to the music. */
export const loadMilkdrop: MilkdropLoader = async () => {
  const [{ default: exported }, { default: pack }] = await Promise.all([
    import('butterchurn'),
    import('butterchurn-presets/lib/butterchurnPresets.min.js'),
  ]);
  const butterchurn = unwrapButterchurn(exported);
  return {
    createVisualizer: (context, canvas, options) =>
      butterchurn.createVisualizer(context, canvas, options),
    presets: pack.getPresets(),
  };
};

/** How long one preset melts into the next, in seconds. */
const BLEND_S = 2.5;

/** Milkdrop's visualizer, shared by every Milkdrop turn of the music layer so
 *  the page holds one WebGL context however often the look changes. It hears
 *  the sound directly and renders off screen, for the layer to draw. */
export class MilkdropStage {
  private engine: MilkdropEngine | null = null;
  private loading = false;
  private failed = false;
  private sound: LiveSound | null = null;
  private visualizer: ButterchurnVisualizer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private variant = 0;
  private pinned: string | null = null;
  private preset: string | null = null;
  private width = 0;
  private height = 0;

  constructor(
    private readonly document: Document,
    private readonly load: MilkdropLoader,
    private readonly onError: (error: unknown) => void,
  ) {}

  /** The sound to hear; a new one (listening again) needs a new visualizer. */
  setSound(sound: LiveSound | null): void {
    if (sound?.context !== this.sound?.context) this.release();
    this.sound = sound;
  }

  /** Shows the preset `variant` picks, from 0 to 1, unless one is pinned. */
  show(variant: number): void {
    this.variant = variant;
    if (this.visualizer) this.loadPreset(BLEND_S);
  }

  /** Keeps `preset` on screen whatever the variant; null lets the variant pick
   *  again. A preset the pack lacks is ignored, so something always shows. */
  pin(preset: string | null): void {
    this.pinned = preset;
    if (this.visualizer) this.loadPreset(BLEND_S);
  }

  /** Renders a frame `width` by `height` CSS pixels, or null while Milkdrop is
   *  loading or cannot run here. The first frame asked for loads it, so a visit
   *  that never listens never downloads it. */
  frame(width: number, height: number): HTMLCanvasElement | null {
    this.startLoading();
    const visualizer = this.visualizer ?? this.create(width, height);
    if (!visualizer || !this.canvas) return null;
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.canvas.width = width;
      this.canvas.height = height;
      visualizer.setRendererSize(width, height);
    }
    visualizer.render();
    return this.canvas;
  }

  dispose(): void {
    this.release();
  }

  private startLoading(): void {
    if (this.engine || this.loading || this.failed || !this.canRun()) return;
    this.loading = true;
    this.load()
      .then((engine) => (this.engine = engine))
      .catch((error: unknown) => this.fail(error))
      .finally(() => (this.loading = false));
  }

  private create(width: number, height: number): ButterchurnVisualizer | null {
    const { engine, sound } = this;
    if (!engine || !sound || this.failed) return null;
    try {
      const canvas = this.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const visualizer = engine.createVisualizer(sound.context, canvas, {
        width,
        height,
        pixelRatio: 1,
      });
      visualizer.connectAudio(sound.source);
      this.canvas = canvas;
      this.visualizer = visualizer;
      this.width = width;
      this.height = height;
      this.preset = null;
      this.loadPreset(0);
      return visualizer;
    } catch (error) {
      this.fail(error);
      return null;
    }
  }

  private loadPreset(blendS: number): void {
    const presets = this.engine?.presets;
    const name = presets ? this.pick(presets) : null;
    if (!presets || !name || name === this.preset) return;
    this.preset = name;
    this.visualizer?.loadPreset(presets[name], blendS);
  }

  private pick(presets: Readonly<Record<string, object>>): string | null {
    if (this.pinned !== null && Object.hasOwn(presets, this.pinned)) return this.pinned;
    return presetFor(this.variant, Object.keys(presets));
  }

  private canRun(): boolean {
    return typeof this.document.defaultView?.WebGL2RenderingContext === 'function';
  }

  private fail(error: unknown): void {
    this.failed = true;
    this.release();
    this.onError(error);
  }

  private release(): void {
    if (this.visualizer && this.sound) this.visualizer.disconnectAudio(this.sound.source);
    this.canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    this.visualizer = null;
    this.canvas = null;
    this.preset = null;
  }
}
