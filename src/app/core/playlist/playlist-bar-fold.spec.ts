import { TestBed } from '@angular/core/testing';
import { PlaylistBarFold } from './playlist-bar-fold';

const STORAGE_KEY = 'observatory.playlistBar';

describe('PlaylistBarFold', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.unstubAllGlobals();
  });

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

  it('starts folded on a phone, until it is unfolded there', () => {
    const phone = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', phone);
    expect(TestBed.inject(PlaylistBarFold).isFolded()).toBe(true);
    expect(phone).toHaveBeenCalledWith('(max-width: 720px)');
    TestBed.inject(PlaylistBarFold).toggle();
    TestBed.resetTestingModule();
    expect(TestBed.inject(PlaylistBarFold).isFolded()).toBe(false);
  });

  it('starts open when storage holds anything else', () => {
    localStorage.setItem(STORAGE_KEY, 'sideways');
    expect(TestBed.inject(PlaylistBarFold).isFolded()).toBe(false);
  });
});
