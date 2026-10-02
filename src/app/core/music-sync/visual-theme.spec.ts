import { MUSIC_POOL } from '../playlist/music-pool';
import { MOTIFS, themeFor } from './visual-theme';

/** The seconds into a track at which its motif changes, over its first hour. */
function changesOf(track: (typeof MUSIC_POOL)[number]): number[] {
  const changes: number[] = [];
  for (let s = 1; s <= 3600; s++)
    if (themeFor(track, s).motif !== themeFor(track, s - 1).motif) changes.push(s);
  return changes;
}

describe('themeFor', () => {
  it('gives a track the same look every time, coloured by its genre', () => {
    const [track] = MUSIC_POOL;
    expect(themeFor(track)).toEqual(themeFor({ ...track }));
    expect(themeFor(track, 500)).toEqual(themeFor({ ...track }, 500));
    expect(themeFor(track).palette).toBe(track.genre);
    expect(themeFor(track, 500).palette).toBe(track.genre);
  });

  it('uses every motif across the pool', () => {
    const used = new Set(MUSIC_POOL.map((track) => themeFor(track).motif));
    expect([...used].sort()).toEqual([...MOTIFS].sort());
  });

  it('changes the motif every 2 to 3 minutes of a track', () => {
    for (const track of MUSIC_POOL) {
      const gaps = changesOf(track).map((s, i, all) => s - (all[i - 1] ?? 0));
      expect(gaps.length).toBeGreaterThanOrEqual(20);
      for (const gap of gaps) {
        expect(gap).toBeGreaterThanOrEqual(120);
        expect(gap).toBeLessThanOrEqual(181);
      }
    }
  });

  it('varies the gap between changes', () => {
    const [track] = MUSIC_POOL;
    const gaps = changesOf(track).map((s, i, all) => s - (all[i - 1] ?? 0));
    expect(new Set(gaps).size).toBeGreaterThan(1);
  });
});
