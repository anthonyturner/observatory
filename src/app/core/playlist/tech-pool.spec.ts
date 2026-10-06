import { MUSIC_POOL } from './music-pool';
import { TECH_POOL } from './tech-pool';

describe('TECH_POOL', () => {
  it('holds only well-formed YouTube ids, none also in the music pool', () => {
    const ids = [...MUSIC_POOL, ...TECH_POOL].map((track) => track.videoId);
    expect(ids.every((id) => /^[\w-]{11}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every video and its channel', () => {
    expect(TECH_POOL.every((track) => track.title && track.artist)).toBe(true);
  });

  it('covers AI, Git and learning, and no music', () => {
    const genres = new Set(TECH_POOL.map((track) => track.genre));
    expect([...genres].sort()).toEqual(['ai', 'git', 'learn']);
  });
});
