import { MUSIC_POOL } from './music-pool';
import { stationsFrom } from './playlist-stations';
import { Genre, Track } from './playlist.types';
import { TECH_POOL } from './tech-pool';

const track = (id: string, genre: Genre): Track => ({
  videoId: id.repeat(11),
  title: id,
  artist: 'Artist',
  genre,
});

describe('stationsFrom', () => {
  it('opens on Music, then AI, Git & GitHub and Learn', () => {
    const stations = stationsFrom([], 12, Math.random);
    expect(stations.map((station) => station.label)).toEqual([
      'Music',
      'AI',
      'Git & GitHub',
      'Learn',
    ]);
  });

  it('gives each station only its own videos, trance and techno both on Music', () => {
    const pool = [track('a', 'trance'), track('b', 'techno'), track('c', 'ai'), track('d', 'git')];
    const [music, ai, git, learn] = stationsFrom(pool, 12, () => 0);
    expect(music.tracks.map((each) => each.genre).sort()).toEqual(['techno', 'trance']);
    expect(ai.tracks).toEqual([pool[2]]);
    expect(git.tracks).toEqual([pool[3]]);
    expect(learn.tracks).toEqual([]);
  });

  it('deals at most `size` videos to a station', () => {
    const pool = ['a', 'b', 'c', 'd'].map((id) => track(id, 'learn'));
    const learn = stationsFrom(pool, 2, Math.random)[3];
    expect(learn.tracks).toHaveLength(2);
  });

  it('leaves no station empty with the real pools', () => {
    const stations = stationsFrom([...MUSIC_POOL, ...TECH_POOL], 12, Math.random);
    expect(stations.every((station) => station.tracks.length > 0)).toBe(true);
  });
});
