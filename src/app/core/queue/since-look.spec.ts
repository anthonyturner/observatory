import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { parseSinceLook, parseSinceLookDiff, sinceLookLabel } from './since-look';
import { SinceLookFeed } from './since-look-feed';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const ANSWER = {
  base: BASE,
  head: HEAD,
  newCommits: 2,
  diff: 'diff --git a/x b/x\n+one\n',
  diffBytes: 24,
  diffTruncated: false,
  diffHidden: false,
  fetchedAt: '2026-10-06T00:00:00Z',
};
const URL = `/api/since-look?repo=me/app&base=${BASE}&head=${HEAD}`;

describe('parseSinceLook', () => {
  it('reads a count, an uncountable change, and nothing', () => {
    expect(parseSinceLook({ newCommits: 3 })).toEqual({ newCommits: 3 });
    expect(parseSinceLook({ newCommits: null })).toEqual({ newCommits: null });
    expect(parseSinceLook({ newCommits: -1 })).toEqual({ newCommits: null });
    expect(parseSinceLook(null)).toBeNull();
    expect(parseSinceLook({})).toBeNull();
  });
});

describe('sinceLookLabel', () => {
  it('counts the new commits, or says it changed when they cannot be counted', () => {
    expect(sinceLookLabel({ newCommits: 1 })).toBe('1 new commit since you looked');
    expect(sinceLookLabel({ newCommits: 4 })).toBe('4 new commits since you looked');
    expect(sinceLookLabel({ newCommits: null })).toBe('Changed since you looked');
  });
});

describe('parseSinceLookDiff', () => {
  it('keeps both heads, the count and the diff', () => {
    expect(parseSinceLookDiff(ANSWER)).toEqual({
      base: BASE,
      head: HEAD,
      newCommits: 2,
      diff: ANSWER.diff,
      diffBytes: 24,
      diffTruncated: false,
      diffHidden: false,
    });
  });

  it('refuses an answer without its heads or a diff', () => {
    expect(parseSinceLookDiff(null)).toBeNull();
    expect(parseSinceLookDiff({ ...ANSWER, base: 7 })).toBeNull();
    expect(parseSinceLookDiff({ ...ANSWER, diff: undefined })).toBeNull();
  });
});

describe('SinceLookFeed', () => {
  function setUp(): { feed: SinceLookFeed; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [SinceLookFeed, provideHttpClient(), provideHttpClientTesting()],
    });
    return { feed: TestBed.inject(SinceLookFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the changes between two heads, then shows them', () => {
    const { feed, http } = setUp();
    expect(feed.state()).toEqual({ status: 'idle' });

    feed.load('me/app', BASE, HEAD);
    expect(feed.state()).toEqual({ status: 'reading' });
    http.expectOne(URL).flush(ANSWER);

    expect(feed.state()).toEqual({
      status: 'ready',
      since: expect.objectContaining({ newCommits: 2, diff: ANSWER.diff }),
    });
  });

  it('says so when the changes cannot be read, and drops a read when cleared', () => {
    const { feed, http } = setUp();

    feed.load('me/app', BASE, HEAD);
    http.expectOne(URL).flush('no', { status: 502, statusText: 'Bad Gateway' });
    expect(feed.state()).toEqual({ status: 'unreachable' });

    feed.load('me/app', BASE, HEAD);
    const pending = http.expectOne(URL);
    feed.clear();
    expect(pending.cancelled).toBe(true);
    expect(feed.state()).toEqual({ status: 'idle' });
  });
});
