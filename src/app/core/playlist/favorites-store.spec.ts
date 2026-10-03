import { TestBed } from '@angular/core/testing';
import { FavoritesStore } from './favorites-store';
import { Track } from './playlist.types';

const KEY = 'observatory.playlist.favorites';
const ONE: Track = { videoId: 'aaaaaaaaaaa', title: 'One', artist: 'A', genre: 'trance' };
const TWO: Track = { videoId: 'bbbbbbbbbbb', title: 'Two', artist: 'B', genre: 'techno' };

const store = (): FavoritesStore => TestBed.inject(FavoritesStore);

describe('FavoritesStore', () => {
  beforeEach(() => localStorage.clear());

  it('hearts a track, then un-hearts it', () => {
    const favorites = store();
    favorites.toggle(ONE);
    favorites.toggle(TWO);
    expect(favorites.tracks()).toEqual([ONE, TWO]);
    expect(favorites.has(ONE.videoId)).toBe(true);

    favorites.toggle(ONE);
    expect(favorites.tracks()).toEqual([TWO]);
    expect(favorites.count()).toBe(1);
  });

  it('keeps favourites for the next visit', () => {
    store().toggle(ONE);
    TestBed.resetTestingModule();
    expect(store().tracks()).toEqual([ONE]);
  });

  it('starts empty when what is stored is not a list', () => {
    localStorage.setItem(KEY, '{not json');
    expect(store().tracks()).toEqual([]);
    TestBed.resetTestingModule();
    localStorage.setItem(KEY, '{"videoId":"aaaaaaaaaaa"}');
    expect(store().tracks()).toEqual([]);
  });

  it('adds tracks after the ones hearted, once each, and removes none', () => {
    const THREE: Track = { videoId: 'ccccccccccc', title: 'Three', artist: 'C', genre: 'trance' };
    const favorites = store();
    favorites.toggle(TWO);
    favorites.addAll([ONE, TWO, THREE, ONE]);
    expect(favorites.tracks()).toEqual([TWO, ONE, THREE]);

    TestBed.resetTestingModule();
    expect(store().tracks()).toEqual([TWO, ONE, THREE]);
  });

  it('leaves the list as it was when every track is already hearted', () => {
    const favorites = store();
    favorites.toggle(ONE);
    const before = favorites.tracks();
    favorites.addAll([ONE]);
    expect(favorites.tracks()).toBe(before);
  });

  it('drops stored entries that are not tracks, and keeps the rest', () => {
    const bad = [{ ...ONE, genre: 'polka' }, { ...ONE, videoId: 'short' }, { title: 'x' }, null];
    localStorage.setItem(KEY, JSON.stringify([...bad, TWO]));
    expect(store().tracks()).toEqual([TWO]);
  });
});
