import type { Butterchurn, ButterchurnVisualizer } from 'butterchurn';
import { LiveSound } from '../sources/audio-tap';
import { CURATED_PRESETS, presetFor } from './milkdrop-presets';
import { MilkdropEngine, MilkdropStage, unwrapButterchurn } from './milkdrop-stage';

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

function soundOf(): LiveSound {
  return { context: {} as AudioContext, source: {} as AudioNode };
}

const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

/** Asks for a first frame, which starts the load, and lets the load land. */
async function warm(stage: MilkdropStage): Promise<void> {
  stage.frame(400, 300);
  await settle();
}

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

  it('loads Milkdrop once, on the first frame asked for, and not before', async () => {
    const { stage, loader } = setup();
    stage.show(0.1);
    await settle();
    expect(loader).not.toHaveBeenCalled();
    stage.frame(400, 300);
    stage.frame(400, 300);
    await settle();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('renders the preset the variant picks once it hears the tab', async () => {
    const { stage, visualizers } = setup();
    stage.show(0.1);
    await warm(stage);
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

  it('melts into the next preset on the next turn', async () => {
    const { stage, visualizers } = setup();
    stage.setSound(soundOf());
    stage.show(0.1);
    await warm(stage);
    stage.frame(400, 300);
    stage.show(0.9);
    expect(visualizers[0].presets.at(-1)?.blendS).toBeGreaterThan(0);
    expect(visualizers).toHaveLength(1);
  });

  it('keeps a pinned preset through the next turn, and lets go of it for Auto', async () => {
    const { stage, visualizers } = setup();
    stage.setSound(soundOf());
    stage.show(0.1);
    await warm(stage);
    stage.frame(400, 300);
    const [visualizer] = visualizers;

    stage.pin(CURATED_PRESETS[5]);
    expect(visualizer.presets.at(-1)).toEqual({
      preset: PRESETS[CURATED_PRESETS[5]],
      blendS: expect.any(Number),
    });
    stage.show(0.9);
    expect(visualizer.presets.at(-1)?.preset).toBe(PRESETS[CURATED_PRESETS[5]]);

    stage.pin(null);
    expect(visualizer.presets.at(-1)?.preset).toBe(PRESETS[presetFor(0.9, CURATED_PRESETS) ?? '']);
  });

  it('starts on a preset pinned before Milkdrop loaded', async () => {
    const { stage, visualizers } = setup();
    stage.setSound(soundOf());
    stage.pin(CURATED_PRESETS[3]);
    stage.show(0.1);
    await warm(stage);
    stage.frame(400, 300);
    expect(visualizers[0].presets).toEqual([{ preset: PRESETS[CURATED_PRESETS[3]], blendS: 0 }]);
  });

  it('lets the variant pick when the pinned preset is not in the pack', async () => {
    const { stage, visualizers } = setup();
    stage.setSound(soundOf());
    stage.pin('missing from the pack');
    stage.show(0.1);
    await warm(stage);
    stage.frame(400, 300);
    expect(visualizers[0].presets.at(-1)?.preset).toBe(
      PRESETS[presetFor(0.1, CURATED_PRESETS) ?? ''],
    );
  });

  it('starts a new visualizer for a new sound, letting go of the old one', async () => {
    const { stage, visualizers } = setup();
    stage.setSound(soundOf());
    stage.show(0.1);
    await warm(stage);
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
    await warm(stage);
    expect(stage.frame(400, 300)).toBeNull();
    expect(errors).toEqual([failure]);
  });

  it('never loads where WebGL 2 is missing', async () => {
    delete window['WebGL2RenderingContext'];
    const { stage, loader } = setup();
    stage.show(0.1);
    await warm(stage);
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

describe('unwrapButterchurn', () => {
  const butterchurn: Butterchurn = { createVisualizer: () => new FakeVisualizer() };

  it('takes Butterchurn as the bundler hands it over', () => {
    expect(unwrapButterchurn(butterchurn)).toBe(butterchurn);
  });

  it('unwraps it where the production build leaves it under default', () => {
    expect(unwrapButterchurn({ default: butterchurn })).toBe(butterchurn);
  });
});
