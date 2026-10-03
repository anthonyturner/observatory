import { TestBed } from '@angular/core/testing';
import { MilkdropChoice } from './milkdrop-choice';
import { CURATED_PRESETS } from './milkdrop-presets';

const STORAGE_KEY = 'observatory.music.milkdrop-preset';

describe('MilkdropChoice', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('starts on Auto, offering the curated presets', () => {
    const choice = TestBed.inject(MilkdropChoice);
    expect(choice.preset()).toBeNull();
    expect(choice.presets).toEqual(CURATED_PRESETS);
  });

  it('keeps a chosen preset between visits', () => {
    TestBed.inject(MilkdropChoice).choose(CURATED_PRESETS[2]);
    TestBed.resetTestingModule();
    expect(TestBed.inject(MilkdropChoice).preset()).toBe(CURATED_PRESETS[2]);
  });

  it('goes back to Auto, and remembers that too', () => {
    TestBed.inject(MilkdropChoice).choose(CURATED_PRESETS[2]);
    TestBed.inject(MilkdropChoice).choose(null);
    TestBed.resetTestingModule();
    expect(TestBed.inject(MilkdropChoice).preset()).toBeNull();
  });

  it('treats a name not on the list as Auto', () => {
    const choice = TestBed.inject(MilkdropChoice);
    choice.choose('not a preset');
    expect(choice.preset()).toBeNull();
  });

  it('falls back to Auto when storage holds an unknown name', () => {
    localStorage.setItem(STORAGE_KEY, 'gone from the pack');
    expect(TestBed.inject(MilkdropChoice).preset()).toBeNull();
  });
});
