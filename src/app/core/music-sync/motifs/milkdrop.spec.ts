import { MilkdropStage } from '../milkdrop/milkdrop-stage';
import { MusicFrame, SILENCE } from '../music-sync.types';
import { Milkdrop } from './milkdrop';
import { MotifLayer, MusicScene } from './motif-layer';

const INKS = { primary: '#fff', secondary: '#fff', accent: '#fff' };
const SCENE: MusicScene = { width: 800, height: 600, originX: 400, originY: 240, coreRadius: 100 };

class FakeLayer implements MotifLayer {
  steps: MusicFrame[] = [];
  draws = 0;
  step(frame: MusicFrame): void {
    this.steps.push(frame);
  }
  draw(): void {
    this.draws++;
  }
}

function stageWith(picture: HTMLCanvasElement | null) {
  const stage = { show: vi.fn(), frame: vi.fn(() => picture) };
  return { stage, asStage: stage as unknown as MilkdropStage };
}

describe('Milkdrop', () => {
  it('shows its variant, rendered at half size', () => {
    const { stage, asStage } = stageWith(document.createElement('canvas'));
    const layer = new Milkdrop(asStage, 0.4, new FakeLayer(), () => 0.8);
    layer.step(SILENCE, 1 / 60, SCENE);
    expect(stage.show).toHaveBeenCalledWith(0.4);
    expect(stage.frame).toHaveBeenCalledWith(400, 300);
  });

  it('renders and draws nothing while hidden', () => {
    const { stage, asStage } = stageWith(document.createElement('canvas'));
    const fallback = new FakeLayer();
    const layer = new Milkdrop(asStage, 0.4, fallback, () => 0);
    layer.step(SILENCE, 1 / 60, SCENE);
    layer.draw({} as CanvasRenderingContext2D, SCENE, INKS);
    expect(stage.frame).not.toHaveBeenCalled();
    expect(fallback.draws).toBe(0);
  });

  it('draws Milkdrop at the opacity asked for', () => {
    const picture = document.createElement('canvas');
    const layer = new Milkdrop(stageWith(picture).asStage, 0.4, new FakeLayer(), () => 0.35);
    const context = { globalAlpha: 1, drawImage: vi.fn() };
    layer.step(SILENCE, 1 / 60, SCENE);
    layer.draw(context as unknown as CanvasRenderingContext2D, SCENE, INKS);
    expect(context.globalAlpha).toBe(0.35);
    expect(context.drawImage).toHaveBeenCalledWith(picture, 0, 0, 800, 600);
  });

  it('lets its stand-in draw until Milkdrop is ready', () => {
    const fallback = new FakeLayer();
    const layer = new Milkdrop(stageWith(null).asStage, 0.4, fallback, () => 0.8);
    layer.step(SILENCE, 1 / 60, SCENE);
    layer.draw({} as CanvasRenderingContext2D, SCENE, INKS);
    expect(fallback.steps).toEqual([SILENCE]);
    expect(fallback.draws).toBe(1);
  });
});
