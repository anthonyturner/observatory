import { TestBed } from '@angular/core/testing';
import { TimelineFold } from './timeline-fold';

const STORAGE_KEY = 'observatory.timeline';

describe('TimelineFold', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('starts folded away', () => {
    expect(TestBed.inject(TimelineFold).isOpen()).toBe(false);
  });

  it('keeps it open between visits, and shut too', () => {
    TestBed.inject(TimelineFold).toggle();
    TestBed.resetTestingModule();
    const fold = TestBed.inject(TimelineFold);
    expect(fold.isOpen()).toBe(true);
    fold.toggle();
    TestBed.resetTestingModule();
    expect(TestBed.inject(TimelineFold).isOpen()).toBe(false);
  });

  it('still opens for this visit where storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const fold = TestBed.inject(TimelineFold);
    expect(fold.isOpen()).toBe(false);
    fold.toggle();
    expect(fold.isOpen()).toBe(true);
  });
});
