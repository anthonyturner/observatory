import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DiffFile } from './diff-files';
import { parsePullFile, pullFileLinkOf } from './pull-file';
import { PullFileFeed } from './pull-file-feed';

const SHA = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const ANSWER = {
  path: 'src/app.ts',
  sha: SHA,
  headOid: HEAD,
  state: 'shown',
  text: 'one\n',
  bytes: 4,
  patch: 'diff --git a/src/app.ts b/src/app.ts\n',
  githubUrl: 'https://github.com/me/app/blob/x/src/app.ts',
  fetchedAt: '2026-10-24T00:00:00Z',
};
const ASK = { repo: 'me/app', number: 7, sha: SHA, path: 'src/app.ts' };
const URL = `/api/pull-file?repo=me/app&number=7&sha=${SHA}&path=src/app.ts`;

describe('parsePullFile', () => {
  it('keeps the file and what is said about it', () => {
    expect(parsePullFile(ANSWER)).toEqual({
      path: 'src/app.ts',
      sha: SHA,
      headOid: HEAD,
      state: 'shown',
      text: 'one\n',
      bytes: 4,
      patch: ANSWER.patch,
      githubUrl: ANSWER.githubUrl,
    });
  });

  it('fills what is missing with the plainest answer', () => {
    expect(parsePullFile({ path: 'a', sha: SHA, state: 'missing', text: '' })).toEqual({
      path: 'a',
      sha: SHA,
      headOid: SHA,
      state: 'missing',
      text: '',
      bytes: 0,
      patch: '',
      githubUrl: '',
    });
  });

  it('refuses an answer without a path, a commit, a text or a state it knows', () => {
    expect(parsePullFile(null)).toBeNull();
    expect(parsePullFile({ ...ANSWER, path: 3 })).toBeNull();
    expect(parsePullFile({ ...ANSWER, sha: undefined })).toBeNull();
    expect(parsePullFile({ ...ANSWER, text: null })).toBeNull();
    expect(parsePullFile({ ...ANSWER, state: 'half-shown' })).toBeNull();
  });
});

describe('pullFileLinkOf', () => {
  const TARGET = { repo: 'me/app', number: 7, sha: SHA };
  const fileOf = (extra: Partial<DiffFile> = {}): DiffFile => ({
    path: 'src/my file&x.ts',
    newPath: 'src/my file&x.ts',
    isDeleted: false,
    additions: 1,
    deletions: 1,
    isBinary: false,
    lines: [],
    ...extra,
  });

  it('names the pull request, the commit and the file at its new path, escaped', () => {
    expect(pullFileLinkOf(TARGET, fileOf())).toBe(
      `/p/me/app/pull/7/file?sha=${SHA}&path=src%2Fmy+file%26x.ts`,
    );
    expect(pullFileLinkOf(TARGET, fileOf({ path: 'old.ts', newPath: 'new.ts' }))).toContain(
      'path=new.ts',
    );
  });

  it('is none without a target, or for a file with nothing at the head to show', () => {
    expect(pullFileLinkOf(null, fileOf())).toBeNull();
    expect(pullFileLinkOf(TARGET, fileOf({ isBinary: true }))).toBeNull();
    expect(pullFileLinkOf(TARGET, fileOf({ isDeleted: true }))).toBeNull();
    expect(pullFileLinkOf(TARGET, fileOf({ newPath: null }))).toBeNull();
  });
});

describe('PullFileFeed', () => {
  function setUp(): { feed: PullFileFeed; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [PullFileFeed, provideHttpClient(), provideHttpClientTesting()],
    });
    return { feed: TestBed.inject(PullFileFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the file by repository, pull request, commit and path, then shows it', () => {
    const { feed, http } = setUp();

    feed.load(ASK);
    expect(feed.state()).toEqual({ status: 'reading' });
    http.expectOne(URL).flush(ANSWER);

    expect(feed.state()).toEqual({
      status: 'ready',
      file: expect.objectContaining({ path: 'src/app.ts', state: 'shown' }),
    });
  });

  it('says so when the file cannot be read, or the answer is not one', () => {
    const { feed, http } = setUp();

    feed.load(ASK);
    http.expectOne(URL).flush('no', { status: 502, statusText: 'Bad Gateway' });
    expect(feed.state()).toEqual({ status: 'unreachable' });

    feed.load(ASK);
    http.expectOne(URL).flush({ nonsense: true });
    expect(feed.state()).toEqual({ status: 'unreachable' });
  });

  it('drops a read still on its way when another file is opened', () => {
    const { feed, http } = setUp();

    feed.load(ASK);
    const first = http.expectOne(URL);
    feed.load({ ...ASK, path: 'other.ts' });
    http.expectOne(`/api/pull-file?repo=me/app&number=7&sha=${SHA}&path=other.ts`).flush({
      ...ANSWER,
      path: 'other.ts',
    });

    expect(first.cancelled).toBe(true);
    expect(feed.state()).toEqual({
      status: 'ready',
      file: expect.objectContaining({ path: 'other.ts' }),
    });
  });
});
