import { BeatHit } from './beat-hit';
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
