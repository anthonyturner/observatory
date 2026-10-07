import { TestBed } from '@angular/core/testing';
import { StatusStripFold } from './status-strip-fold';

const STORAGE_KEY = 'observatory.statusStrip';

describe('StatusStripFold', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('starts open', () => {
    expect(TestBed.inject(StatusStripFold).isFolded()).toBe(false);
  });

  it('keeps the fold between visits, and the unfold too', () => {
    TestBed.inject(StatusStripFold).toggle();
    TestBed.resetTestingModule();
    const fold = TestBed.inject(StatusStripFold);
    expect(fold.isFolded()).toBe(true);
    fold.toggle();
    TestBed.resetTestingModule();
    expect(TestBed.inject(StatusStripFold).isFolded()).toBe(false);
  });

  it('still folds for this visit where storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const fold = TestBed.inject(StatusStripFold);
    expect(fold.isFolded()).toBe(false);
    fold.toggle();
    expect(fold.isFolded()).toBe(true);
  });
});
