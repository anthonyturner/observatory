import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { parseCommitDiff } from './commit-diff';
import { CommitDiffFeed } from './commit-diff-feed';

const ANSWER = {
  sha: 'abc1234',
  diff: 'diff --git a/x b/x\n+one\n',
  diffBytes: 24,
  diffTruncated: false,
  diffHidden: false,
  fetchedAt: '2026-10-05T00:00:00Z',
};

describe('parseCommitDiff', () => {
  it('keeps the diff and what is said about it', () => {
    expect(parseCommitDiff({ ...ANSWER, diffTruncated: true })).toEqual({
      sha: 'abc1234',
      diff: ANSWER.diff,
      diffBytes: 24,
      diffTruncated: true,
      diffHidden: false,
    });
  });

  it('refuses an answer without a hash or a diff', () => {
    expect(parseCommitDiff(null)).toBeNull();
    expect(parseCommitDiff({ sha: 'abc1234' })).toBeNull();
    expect(parseCommitDiff({ diff: '' })).toBeNull();
  });
});

describe('CommitDiffFeed', () => {
  function setUp(): { feed: CommitDiffFeed; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [CommitDiffFeed, provideHttpClient(), provideHttpClientTesting()],
    });
    return { feed: TestBed.inject(CommitDiffFeed), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the commit by repository and hash, then shows it', () => {
    const { feed, http } = setUp();

    feed.load('me/app', 'abc1234');
    expect(feed.state()).toEqual({ status: 'reading' });
    http.expectOne('/api/commit?repo=me/app&sha=abc1234').flush(ANSWER);

    expect(feed.state()).toEqual({
      status: 'ready',
      commit: expect.objectContaining({ sha: 'abc1234', diff: ANSWER.diff }),
    });
  });

  it('says so when the commit cannot be read', () => {
    const { feed, http } = setUp();

    feed.load('me/app', 'abc1234');
    http.expectOne('/api/commit?repo=me/app&sha=abc1234').flush('no', {
      status: 502,
      statusText: 'Bad Gateway',
    });

    expect(feed.state()).toEqual({ status: 'unreachable' });
  });

  it('drops a read still on its way when another commit is opened', () => {
    const { feed, http } = setUp();

    feed.load('me/app', 'abc1234');
    const first = http.expectOne('/api/commit?repo=me/app&sha=abc1234');
    feed.load('me/app', 'def5678');
    http.expectOne('/api/commit?repo=me/app&sha=def5678').flush({ ...ANSWER, sha: 'def5678' });

    expect(first.cancelled).toBe(true);
    expect(feed.state()).toEqual({
      status: 'ready',
      commit: expect.objectContaining({ sha: 'def5678' }),
    });
  });
});
