import { TRANCE_PLAYLIST } from './trance-playlist';

describe('TRANCE_PLAYLIST', () => {
  it('holds only well-formed YouTube ids, each once', () => {
    const ids = TRANCE_PLAYLIST.map((track) => track.videoId);
    expect(ids.every((id) => /^[\w-]{11}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every track and its artist', () => {
    expect(TRANCE_PLAYLIST.every((track) => track.title && track.artist)).toBe(true);
  });
});
