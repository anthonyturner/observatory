import { TestBed } from '@angular/core/testing';
import { MergeMethodChoice } from './merge-method-choice';

const STORAGE_KEY = 'observatory.merge-method';

describe('MergeMethodChoice', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts on squash, and remembers the method last picked', () => {
    expect(TestBed.inject(MergeMethodChoice).chosen()).toBe('squash');

    TestBed.inject(MergeMethodChoice).choose('rebase');
    TestBed.resetTestingModule();

    expect(localStorage.getItem(STORAGE_KEY)).toBe('rebase');
    expect(TestBed.inject(MergeMethodChoice).chosen()).toBe('rebase');
  });

  it('ignores a stored word that is not a method', () => {
    localStorage.setItem(STORAGE_KEY, 'force-push');

    expect(TestBed.inject(MergeMethodChoice).chosen()).toBe('squash');
  });

  it('still works for this visit where storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const choice = TestBed.inject(MergeMethodChoice);

    choice.choose('merge');

    expect(choice.chosen()).toBe('merge');
  });
});
