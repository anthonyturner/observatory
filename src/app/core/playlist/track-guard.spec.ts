import { GENRES } from './playlist.types';
import { isTrack } from './track-guard';

const stored = (genre: string) => ({
  videoId: 'aircAruvnKk',
  title: 'But what is a neural network?',
  artist: '3Blue1Brown',
  genre,
});

describe('isTrack', () => {
  it('accepts a track of every genre, the tech stations’ included', () => {
    expect(GENRES.every((genre) => isTrack(stored(genre)))).toBe(true);
  });

  it('refuses an unknown genre or a malformed id', () => {
    expect(isTrack(stored('jazz'))).toBe(false);
    expect(isTrack({ ...stored('ai'), videoId: 'short' })).toBe(false);
    expect(isTrack(null)).toBe(false);
  });
});
