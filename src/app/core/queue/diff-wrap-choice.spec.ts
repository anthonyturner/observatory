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
