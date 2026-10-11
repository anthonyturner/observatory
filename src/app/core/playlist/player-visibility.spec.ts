import { TestBed } from '@angular/core/testing';
import { PlayerVisibility } from './player-visibility';

const STORAGE_KEY = 'observatory.playerShown';

describe('PlayerVisibility', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it('starts shown', () => {
    expect(TestBed.inject(PlayerVisibility).isShown()).toBe(true);
  });

  it('keeps the player hidden between visits, and shown again too', () => {
    TestBed.inject(PlayerVisibility).toggle();
    TestBed.resetTestingModule();
    const visibility = TestBed.inject(PlayerVisibility);
    expect(visibility.isShown()).toBe(false);
    visibility.toggle();
    TestBed.resetTestingModule();
    expect(TestBed.inject(PlayerVisibility).isShown()).toBe(true);
  });

  it('starts shown when storage holds anything else', () => {
    localStorage.setItem(STORAGE_KEY, 'sideways');
    expect(TestBed.inject(PlayerVisibility).isShown()).toBe(true);
  });

  it('works for this visit where storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const visibility = TestBed.inject(PlayerVisibility);
    expect(visibility.isShown()).toBe(true);
    visibility.toggle();
    expect(visibility.isShown()).toBe(false);
  });
});
