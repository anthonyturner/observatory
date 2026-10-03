import { BeatHit, zoomAnchor } from './beat-hit';
import { MusicInks, MusicScene } from './motifs/motif-layer';
import { MusicFrame, SILENCE } from './music-sync.types';

const SCENE: MusicScene = { width: 800, height: 600, originX: 400, originY: 240, coreRadius: 100 };
const INKS: MusicInks = { primary: '#fff', secondary: '#f0f', accent: '#0ff' };
const BEAT: MusicFrame = { ...SILENCE, beat: true, pulse: 1 };

describe('BeatHit', () => {
  it('zooms the sky on a beat and settles back as the pulse dies', () => {
    const hit = new BeatHit();
    hit.step(SILENCE, 1 / 60, SCENE);
    expect(hit.zoom()).toBe(1);
    hit.step(BEAT, 1 / 60, SCENE);
    expect(hit.zoom()).toBeGreaterThan(1);
    hit.step({ ...SILENCE, pulse: 0.2 }, 1 / 60, SCENE);
    expect(hit.zoom()).toBeLessThan(1.02);
  });

  it('zooms less on a softened beat, and not at all at no strength', () => {
    const full = new BeatHit();
    const soft = new BeatHit();
    const none = new BeatHit();
    soft.setStrength(0.5);
    none.setStrength(0);
    for (const hit of [full, soft, none]) hit.step(BEAT, 1 / 60, SCENE);
    expect(soft.zoom() - 1).toBeCloseTo((full.zoom() - 1) / 2);
    expect(none.zoom()).toBe(1);
  });

  it('draws nothing on a beat at no strength', () => {
    const hit = new BeatHit();
    hit.setStrength(0);
    hit.step(BEAT, 1 / 60, SCENE);
    const alphas: number[] = [];
    const context = {
      set globalAlpha(alpha: number) {
        alphas.push(alpha);
      },
      createRadialGradient: () => ({ addColorStop: () => undefined }),
      fillRect: () => undefined,
      beginPath: () => undefined,
      arc: () => undefined,
      stroke: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    hit.draw(context, SCENE, INKS);
    expect(alphas.length).toBeGreaterThan(0);
    expect(alphas.every((alpha) => alpha === 0)).toBe(true);
  });
});

describe('zoomAnchor', () => {
  it('zooms about the core while it is on the screen', () => {
    expect(zoomAnchor(SCENE)).toEqual({ x: 400, y: 240 });
  });

  it('holds to the top edge once the core is scrolled up off the screen', () => {
    expect(zoomAnchor({ ...SCENE, originY: -900 })).toEqual({ x: 400, y: 0 });
  });

  it('holds to the screen when the core is past its bottom or sides', () => {
    expect(zoomAnchor({ ...SCENE, originX: -50, originY: 1400 })).toEqual({ x: 0, y: 600 });
    expect(zoomAnchor({ ...SCENE, originX: 1200 })).toEqual({ x: 800, y: 240 });
  });
});
