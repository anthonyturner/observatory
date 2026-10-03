import type { ButterchurnVisualizer } from 'butterchurn';
import { TabSound } from '../tab-audio';
import { CURATED_PRESETS, presetFor } from './milkdrop-presets';
import { MilkdropEngine, MilkdropStage } from './milkdrop-stage';

class FakeVisualizer implements ButterchurnVisualizer {
  connected: AudioNode[] = [];
  presets: { preset: object; blendS: number }[] = [];
  renders = 0;
  connectAudio(node: AudioNode): void {
    this.connected.push(node);
  }
  disconnectAudio(node: AudioNode): void {
    this.connected = this.connected.filter((connected) => connected !== node);
  }
  loadPreset(preset: object, blendS: number): void {
    this.presets.push({ preset, blendS });
  }
  setRendererSize(): void {
    // Nothing to resize in a fake.
  }
  render(): void {
    this.renders++;
  }
}

const PRESETS: Record<string, object> = Object.fromEntries(
  CURATED_PRESETS.map((name) => [name, { name }]),
);

function soundOf(): TabSound {
  return { context: {} as AudioContext, source: {} as AudioNode };
}

const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

function setup(load?: () => Promise<MilkdropEngine>) {
  const visualizers: FakeVisualizer[] = [];
  const errors: unknown[] = [];
  const engine: MilkdropEngine = {
    createVisualizer: () => {
      const visualizer = new FakeVisualizer();
      visualizers.push(visualizer);
      return visualizer;
    },
    presets: PRESETS,
  };
  const loader = vi.fn(load ?? (() => Promise.resolve(engine)));
  const stage = new MilkdropStage(document, loader, (error) => errors.push(error));
  return { stage, loader, visualizers, errors, engine };
}

describe('MilkdropStage', () => {
  const window = document.defaultView as unknown as Record<string, unknown>;

  // Any constructor will do: the stage only asks whether WebGL 2 exists.
  beforeEach(() => (window['WebGL2RenderingContext'] = Object));
  afterEach(() => delete window['WebGL2RenderingContext']);

  it('loads Milkdrop once, on the first Milkdrop turn', async () => {
    const { stage, loader } = setup();
    stage.show(0.1);
    stage.show(0.6);
    await settle();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('renders the preset the variant picks once it hears the tab', async () => {
    const { stage, visualizers } = setup();
    stage.show(0.1);
    await settle();
    expect(stage.frame(400, 300)).toBeNull();

    const sound = soundOf();
    stage.setSound(sound);
    expect(stage.frame(400, 300)).not.toBeNull();
    const [visualizer] = visualizers;
    expect(visualizer.connected).toEqual([sound.source]);
    expect(visualizer.presets).toEqual([
      { preset: PRESETS[presetFor(0.1, CURATED_PRESETS) ?? ''], blendS: 0 },
    ]);
    expect(visualizer.renders).toBe(1);
  });

  it('melts into the next preset on the next Milkdrop turn', async () => {
    const { stage, visualizers } = setup();
    stage.setSound(soundOf());
    stage.show(0.1);
    await settle();
    stage.frame(400, 300);
    stage.show(0.9);
    expect(visualizers[0].presets.at(-1)?.blendS).toBeGreaterThan(0);
    expect(visualizers).toHaveLength(1);
  });

  it('starts a new visualizer for a new sound, letting go of the old one', async () => {
    const { stage, visualizers } = setup();
    stage.setSound(soundOf());
    stage.show(0.1);
    await settle();
    stage.frame(400, 300);
    stage.setSound(soundOf());
    stage.frame(400, 300);
    expect(visualizers).toHaveLength(2);
    expect(visualizers[0].connected).toEqual([]);
  });

  it('reports a failed load and draws nothing', async () => {
    const failure = new Error('no chunk');
    const { stage, errors } = setup(() => Promise.reject(failure));
    stage.setSound(soundOf());
    stage.show(0.1);
    await settle();
    expect(stage.frame(400, 300)).toBeNull();
    expect(errors).toEqual([failure]);
  });

  it('never loads where WebGL 2 is missing', async () => {
    delete window['WebGL2RenderingContext'];
    const { stage, loader } = setup();
    stage.show(0.1);
    await settle();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe('presetFor', () => {
  it('picks across the curated presets the pack has', () => {
    expect(presetFor(0, CURATED_PRESETS)).toBe(CURATED_PRESETS[0]);
    expect(presetFor(0.999, CURATED_PRESETS)).toBe(CURATED_PRESETS.at(-1));
    expect(presetFor(1, CURATED_PRESETS)).toBe(CURATED_PRESETS.at(-1));
  });

  it('falls back to any preset when the pack has none of the curated ones', () => {
    expect(presetFor(0.5, ['only'])).toBe('only');
    expect(presetFor(0.5, [])).toBeNull();
  });
});
