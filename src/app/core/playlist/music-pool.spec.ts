import { MUSIC_POOL } from './music-pool';

describe('MUSIC_POOL', () => {
  it('holds only well-formed YouTube ids, each once', () => {
    const ids = MUSIC_POOL.map((track) => track.videoId);
    expect(ids.every((id) => /^[\w-]{11}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every track and its artist', () => {
    expect(MUSIC_POOL.every((track) => track.title && track.artist)).toBe(true);
  });

  it('holds both trance and techno', () => {
    const genres = new Set(MUSIC_POOL.map((track) => track.genre));
    expect([...genres].sort()).toEqual(['techno', 'trance']);
  });
});
