import { BeatHit, zoomAnchor } from './beat-hit';
import { MusicScene } from './motifs/motif-layer';
import { MusicFrame, SILENCE } from './music-sync.types';

const SCENE: MusicScene = { width: 800, height: 600, originX: 400, originY: 240, coreRadius: 100 };
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
