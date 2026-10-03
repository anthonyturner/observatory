import { TestBed } from '@angular/core/testing';
import { BeatStrength, DEFAULT_BEAT_STRENGTH } from './beat-strength';

const STORAGE_KEY = 'observatory.music.beat-strength';

describe('BeatStrength', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('starts at full strength', () => {
    expect(TestBed.inject(BeatStrength).level()).toBe(DEFAULT_BEAT_STRENGTH);
    expect(DEFAULT_BEAT_STRENGTH).toBe(1);
  });

  it('keeps a strength between visits', () => {
    TestBed.inject(BeatStrength).set(0.4);
    TestBed.resetTestingModule();
    expect(TestBed.inject(BeatStrength).level()).toBe(0.4);
  });

  it('holds a strength within 0 to 1', () => {
    const strength = TestBed.inject(BeatStrength);
    strength.set(3);
    expect(strength.level()).toBe(1);
    strength.set(-1);
    expect(strength.level()).toBe(0);
  });

  it('falls back to full strength when storage holds nonsense', () => {
    localStorage.setItem(STORAGE_KEY, 'thump');
    expect(TestBed.inject(BeatStrength).level()).toBe(DEFAULT_BEAT_STRENGTH);
  });
});
