import { TestBed } from '@angular/core/testing';
import { PlaylistBarFold } from './playlist-bar-fold';

const STORAGE_KEY = 'observatory.playlistBar';

describe('PlaylistBarFold', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('starts open', () => {
    expect(TestBed.inject(PlaylistBarFold).isFolded()).toBe(false);
  });

  it('keeps the fold between visits, and the unfold too', () => {
    TestBed.inject(PlaylistBarFold).toggle();
    TestBed.resetTestingModule();
    const fold = TestBed.inject(PlaylistBarFold);
    expect(fold.isFolded()).toBe(true);
    fold.toggle();
    TestBed.resetTestingModule();
    expect(TestBed.inject(PlaylistBarFold).isFolded()).toBe(false);
  });

  it('starts open when storage holds anything else', () => {
    localStorage.setItem(STORAGE_KEY, 'sideways');
    expect(TestBed.inject(PlaylistBarFold).isFolded()).toBe(false);
  });
});
