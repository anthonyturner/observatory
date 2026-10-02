import { MUSIC_POOL } from '../playlist/music-pool';
import { MOTIFS, themeFor } from './visual-theme';

describe('themeFor', () => {
  it('gives a track the same look every time, coloured by its genre', () => {
    const [track] = MUSIC_POOL;
    expect(themeFor(track)).toEqual(themeFor({ ...track }));
    expect(themeFor(track).palette).toBe(track.genre);
  });

  it('uses every motif across the pool', () => {
    const used = new Set(MUSIC_POOL.map((track) => themeFor(track).motif));
    expect([...used].sort()).toEqual([...MOTIFS].sort());
  });
});
