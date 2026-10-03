import { TestBed } from '@angular/core/testing';
import { DEFAULT_MILKDROP_OPACITY, MilkdropOpacity } from './milkdrop-opacity';

const STORAGE_KEY = 'observatory.music.milkdrop-opacity';

describe('MilkdropOpacity', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('starts at the default', () => {
    expect(TestBed.inject(MilkdropOpacity).level()).toBe(DEFAULT_MILKDROP_OPACITY);
  });

  it('keeps a level between visits', () => {
    TestBed.inject(MilkdropOpacity).set(0.35);
    TestBed.resetTestingModule();
    expect(TestBed.inject(MilkdropOpacity).level()).toBe(0.35);
  });

  it('holds a level within 0 to 1', () => {
    const opacity = TestBed.inject(MilkdropOpacity);
    opacity.set(1.7);
    expect(opacity.level()).toBe(1);
    opacity.set(-2);
    expect(opacity.level()).toBe(0);
  });

  it('falls back to the default when storage holds nonsense', () => {
    localStorage.setItem(STORAGE_KEY, 'loud');
    expect(TestBed.inject(MilkdropOpacity).level()).toBe(DEFAULT_MILKDROP_OPACITY);
  });
});
