import { TestBed } from '@angular/core/testing';
import { DiffFile } from './diff-files';
import { ViewedFiles, commitDiffKey, pullDiffKey, seenFileOf } from './viewed-files';

const KEY = 'observatory.diff-viewed';
const PULL = pullDiffKey('me/app', 7);
const APP = { path: 'src/app.ts', fingerprint: 'f1' };
const README = { path: 'README.md', fingerprint: 'f2' };

const service = (): ViewedFiles => TestBed.inject(ViewedFiles);
const fileOf = (path: string, lines: string[]): DiffFile => ({
  path,
  additions: 0,
  deletions: 0,
  lines,
});

describe('ViewedFiles', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('ticks a file, then unticks it', () => {
    const viewed = service();
    viewed.mark(PULL, APP);
    expect(viewed.isViewed(PULL, APP)).toBe(true);
    expect(viewed.isViewed(PULL, README)).toBe(false);

    viewed.unmark(PULL, APP.path);
    expect(viewed.isViewed(PULL, APP)).toBe(false);
  });

  it('keeps each diff apart', () => {
    const viewed = service();
    viewed.mark(PULL, APP);
    expect(viewed.isViewed(commitDiffKey('me/app', 7, 'abc'), APP)).toBe(false);
    expect(viewed.isViewed(pullDiffKey('me/app', 8), APP)).toBe(false);
  });

  it('unticks a file whose text changed after it was ticked', () => {
    const viewed = service();
    viewed.mark(PULL, APP);
    expect(viewed.isViewed(PULL, { ...APP, fingerprint: 'changed' })).toBe(false);
  });

  it('keeps ticks for the next visit', () => {
    service().mark(PULL, APP);
    TestBed.resetTestingModule();
    expect(service().isViewed(PULL, APP)).toBe(true);
  });

  it('forgets the diff ticked longest ago past two hundred', () => {
    const viewed = service();
    for (let number = 1; number <= 201; number++) viewed.mark(pullDiffKey('me/app', number), APP);
    viewed.mark(pullDiffKey('me/app', 2), README);

    expect(viewed.isViewed(pullDiffKey('me/app', 1), APP)).toBe(false);
    expect(viewed.isViewed(pullDiffKey('me/app', 2), APP)).toBe(true);
    expect(viewed.isViewed(pullDiffKey('me/app', 201), APP)).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toHaveLength(200);
  });

  it('stores nothing for a diff with no ticks left', () => {
    const viewed = service();
    viewed.mark(PULL, APP);
    viewed.unmark(PULL, APP.path);
    expect(localStorage.getItem(KEY)).toBe('[]');
  });

  it('drops stored entries that are not diffs, and keeps the rest', () => {
    const good = { diff: PULL, files: { [APP.path]: APP.fingerprint } };
    const bad = [{ diff: 1, files: {} }, { diff: 'x', files: { a: 2 } }, { diff: 'y' }, null];
    localStorage.setItem(KEY, JSON.stringify([...bad, good]));
    expect(service().isViewed(PULL, APP)).toBe(true);
  });

  it('starts with nothing ticked when what is stored is not a list', () => {
    localStorage.setItem(KEY, '{not json');
    expect(service().isViewed(PULL, APP)).toBe(false);
  });

  it('still ticks for this visit when storage refuses', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const viewed = service();
    viewed.mark(PULL, APP);
    expect(viewed.isViewed(PULL, APP)).toBe(true);
  });
});

describe('seenFileOf', () => {
  it('fingerprints a file by its text, so any change to it shows', () => {
    const before = seenFileOf(fileOf('a.ts', ['@@ -1 +1 @@', '+one']));
    const same = seenFileOf(fileOf('a.ts', ['@@ -1 +1 @@', '+one']));
    const after = seenFileOf(fileOf('a.ts', ['@@ -1 +1 @@', '+two']));

    expect(before).toEqual(same);
    expect(before.path).toBe('a.ts');
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });
});
