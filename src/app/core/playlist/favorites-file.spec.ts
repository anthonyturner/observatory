import { favoritesFileNameOf, favoritesFileOf, readFavoritesFile } from './favorites-file';
import { Track } from './playlist.types';

const ONE: Track = { videoId: 'aaaaaaaaaaa', title: 'One', artist: 'A', genre: 'trance' };
const TWO: Track = { videoId: 'bbbbbbbbbbb', title: 'Two', artist: 'B', genre: 'techno' };
const EXPORTED_AT = new Date(2026, 9, 3, 21, 30);

const exportOf = (tracks: readonly unknown[]): string =>
  JSON.stringify({ format: 'observatory.favorites', version: 1, exportedAt: '', tracks });

describe('favourites file', () => {
  it('writes a format, a version, the export time and the tracks', () => {
    expect(JSON.parse(favoritesFileOf([ONE, TWO], EXPORTED_AT))).toEqual({
      format: 'observatory.favorites',
      version: 1,
      exportedAt: EXPORTED_AT.toISOString(),
      tracks: [ONE, TWO],
    });
  });

  it('reads back what it wrote', () => {
    expect(readFavoritesFile(favoritesFileOf([ONE, TWO], EXPORTED_AT))).toEqual({
      isExport: true,
      tracks: [ONE, TWO],
      invalid: 0,
    });
  });

  it('names the file for the local day', () => {
    expect(favoritesFileNameOf(EXPORTED_AT)).toBe('observatory-favorites-2026-10-03.json');
    expect(favoritesFileNameOf(new Date(2027, 0, 9))).toBe('observatory-favorites-2027-01-09.json');
  });

  it('drops entries that are not tracks and counts them', () => {
    const bad = [{ ...ONE, genre: 'polka' }, { ...TWO, videoId: 'short' }, 'x', null];
    expect(readFavoritesFile(exportOf([ONE, ...bad, TWO]))).toEqual({
      isExport: true,
      tracks: [ONE, TWO],
      invalid: 4,
    });
  });

  it.each([
    ['text that is not JSON', '{not json'],
    ['a bare list of tracks', JSON.stringify([ONE])],
    ['JSON null', 'null'],
    ['another format', JSON.stringify({ format: 'other', version: 1, tracks: [ONE] })],
    [
      'a version it cannot read',
      JSON.stringify({ format: 'observatory.favorites', version: 2, tracks: [ONE] }),
    ],
    [
      'tracks that are not a list',
      JSON.stringify({ format: 'observatory.favorites', version: 1, tracks: {} }),
    ],
  ])('turns away %s', (_case, text) => {
    expect(readFavoritesFile(text)).toEqual({ isExport: false });
  });
});
