import { TestBed } from '@angular/core/testing';
import { DiffWrapChoice } from './diff-wrap-choice';

const STORAGE_KEY = 'observatory.diff-wrap';

describe('DiffWrapChoice', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('wraps until scrolling is picked, and remembers the pick', () => {
    expect(TestBed.inject(DiffWrapChoice).wraps()).toBe(true);

    TestBed.inject(DiffWrapChoice).choose(false);
    TestBed.resetTestingModule();

    expect(TestBed.inject(DiffWrapChoice).wraps()).toBe(false);
  });

  it('forgets the stored pick once wrapping is picked again', () => {
    localStorage.setItem(STORAGE_KEY, 'scroll');

    TestBed.inject(DiffWrapChoice).choose(true);

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('follows the pick made in another tab, here and in every open diff', () => {
    const choice = TestBed.inject(DiffWrapChoice);
    const storedElsewhere = (newValue: string | null, key: string | null = STORAGE_KEY) =>
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }));

    storedElsewhere('scroll');
    expect(choice.wraps()).toBe(false);

    storedElsewhere(null);
    expect(choice.wraps()).toBe(true);

    storedElsewhere('scroll');
    storedElsewhere('scroll', 'observatory.motion');
    expect(choice.wraps()).toBe(false);

    storedElsewhere(null, null);
    expect(choice.wraps()).toBe(true);
  });

  it('still works for this visit where storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const choice = TestBed.inject(DiffWrapChoice);
    expect(choice.wraps()).toBe(true);

    choice.choose(false);

    expect(choice.wraps()).toBe(false);
  });
});
