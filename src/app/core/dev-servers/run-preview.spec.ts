import { TestBed } from '@angular/core/testing';
import { Observable, map, of, timer } from 'rxjs';
import { DEV_SERVER_API, DevServerApi } from './dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from './dev-server.types';
import { SITE_OPENER } from './site-opener';
import { RUNNING_POLL_MS, RunPreviews, STATUS_POLL_MS } from './run-preview';

const RUNNING: DevServerStatus = { state: 'running', url: 'http://localhost:5173/' };
const OPENS_SITE = 'opens http://localhost:5173/';

interface Answers {
  readonly start?: DevServerStatus;
  readonly first?: DevServerStatus;
  readonly blocksTabs?: boolean;
  /** How long Stop takes to answer; at once when not given. */
  readonly stopTakes?: number;
}

/** The previews, with `me/app` already shown on a screen, where its server first reads as `first`. */
function setUp(answers: Answers = {}) {
  const { start = STARTING, first = STOPPED, blocksTabs = false, stopTakes } = answers;
  const polls: DevServerStatus[] = [first];
  const log: string[] = [];
  const api: DevServerApi = {
    status: (repo) => {
      log.push(`status ${repo}`);
      return of(polls.shift() ?? STOPPED);
    },
    start: (repo) => {
      log.push(`start ${repo}`);
      return of(start);
    },
    stop: (repo): Observable<DevServerStatus> => {
      log.push(`stop ${repo}`);
      return stopTakes === undefined ? of(STOPPED) : timer(stopTakes).pipe(map(() => STOPPED));
    },
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DEV_SERVER_API, useValue: api },
      {
        provide: SITE_OPENER,
        useValue: {
          open: (url: string) => {
            log.push(`opens ${url}`);
            return !blocksTabs;
          },
        },
      },
    ],
  });
  const previews = TestBed.inject(RunPreviews);
  const preview = previews.runFor('me/app');
  const release = preview.watch();
  const watched = [...log];
  log.length = 0;
  const opened = (): string[] => log.filter((entry) => entry.startsWith('opens'));
  return { previews, preview, release, log, polls, watched, opened };
}

describe('RunPreviews', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a server that is already running, without opening a tab', () => {
    const { preview, watched, opened } = setUp({ first: RUNNING });

    expect(preview.status()).toEqual(RUNNING);
    expect(watched).toEqual(['status me/app']);
    expect(opened()).toEqual([]);
  });

  it('opens no tab at the click, and opens the site once the server reports it running', () => {
    const { preview, log, polls } = setUp();
    polls.push(STARTING, RUNNING);

    preview.run();

    expect(log).toEqual(['start me/app']);
    expect(preview.status()).toEqual(STARTING);

    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(preview.status()).toEqual(STARTING);
    expect(log).not.toContain(OPENS_SITE);

    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(preview.status()).toEqual(RUNNING);
    expect(preview.isTabBlocked()).toBe(false);
    expect(log).toEqual(['start me/app', 'status me/app', 'status me/app', OPENS_SITE]);
  });

  it('opens the site once, however long the server then runs', () => {
    const { preview, polls, opened } = setUp({ start: RUNNING });
    preview.run();
    polls.push(RUNNING, RUNNING);

    vi.advanceTimersByTime(RUNNING_POLL_MS * 2);

    expect(opened()).toEqual([OPENS_SITE]);
  });

  it('opens the site at once when the server was already running', () => {
    const { preview, log } = setUp({ start: RUNNING });

    preview.run();

    expect(log).toEqual(['start me/app', OPENS_SITE]);
    expect(preview.status()).toEqual(RUNNING);
  });

  it('says the browser blocked the tab, and leaves the site running to open by hand', () => {
    const { preview } = setUp({ start: RUNNING, blocksTabs: true });

    preview.run();

    expect(preview.status()).toEqual(RUNNING);
    expect(preview.isTabBlocked()).toBe(true);
  });

  it('forgets a block once the site is opened by hand', () => {
    const { preview } = setUp({ start: RUNNING, blocksTabs: true });
    preview.run();

    preview.siteOpenedByHand();

    expect(preview.isTabBlocked()).toBe(false);
    expect(preview.status()).toEqual(RUNNING);
  });

  it('forgets a block when the server is stopped', () => {
    const { preview } = setUp({ start: RUNNING, blocksTabs: true });
    preview.run();

    preview.stop();

    expect(preview.isTabBlocked()).toBe(false);
  });

  it('keeps asking, slowly, once the server is up', () => {
    const { preview, log, polls } = setUp();
    polls.push(RUNNING);
    preview.run();
    vi.advanceTimersByTime(STATUS_POLL_MS);
    log.length = 0;

    vi.advanceTimersByTime(STATUS_POLL_MS * 5);
    expect(log).toEqual([]);

    polls.push(RUNNING);
    vi.advanceTimersByTime(RUNNING_POLL_MS);
    expect(log).toEqual(['status me/app']);
  });

  it('shows Run again, with the reason, when a running server dies', () => {
    const failed: DevServerStatus = { state: 'failed', reason: 'It exited.' };
    const { preview, log, polls } = setUp({ first: RUNNING });
    polls.push(failed);

    vi.advanceTimersByTime(RUNNING_POLL_MS);
    expect(preview.status()).toEqual(failed);
    log.length = 0;

    vi.advanceTimersByTime(RUNNING_POLL_MS * 3);
    expect(log).toEqual([]);
  });

  it('opens nothing for a server that was running when the page opened, or that then stops', () => {
    const { preview, polls, opened } = setUp({ first: RUNNING });
    polls.push(STOPPED);

    vi.advanceTimersByTime(RUNNING_POLL_MS);

    expect(preview.status()).toEqual(STOPPED);
    expect(opened()).toEqual([]);
  });

  it('opens nothing, and says why, when the server could not start', () => {
    const failed: DevServerStatus = { state: 'failed', reason: 'No script.' };
    const { preview, log } = setUp({ start: failed });

    preview.run();

    expect(preview.status()).toEqual(failed);
    expect(log).toEqual(['start me/app']);
  });

  it('opens nothing when the server ends while it is starting', () => {
    const failed: DevServerStatus = { state: 'failed', reason: 'It exited.' };
    const { preview, polls, opened } = setUp();
    polls.push(failed);

    preview.run();
    vi.advanceTimersByTime(STATUS_POLL_MS);

    expect(preview.status()).toEqual(failed);
    expect(opened()).toEqual([]);
  });

  it('stops the server and the polling, and opens nothing for a server it had been waiting on', () => {
    const { preview, log, polls, opened } = setUp();
    preview.run();
    log.length = 0;
    polls.push(RUNNING);

    preview.stop();
    vi.advanceTimersByTime(STATUS_POLL_MS * 3);

    expect(preview.status()).toEqual(STOPPED);
    expect(log).toEqual(['stop me/app']);
    expect(opened()).toEqual([]);
  });

  it('stops polling when the app goes', () => {
    const { preview, log } = setUp();
    preview.run();
    log.length = 0;

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(STATUS_POLL_MS * 3);

    expect(log).toEqual([]);
    expect(preview.status()).toEqual(STARTING);
  });

  describe('shared by every screen showing a project', () => {
    it('hands every caller the same state for a project, and its own to each other project', () => {
      const { previews, preview } = setUp();

      preview.run();

      expect(previews.runFor('me/app')).toBe(preview);
      expect(previews.runFor('me/app').status()).toEqual(STARTING);
      expect(previews.runFor('me/other').status()).toEqual(STOPPED);
    });

    it('keeps a start going when the screen that began it goes, and opens the site once for the next', () => {
      const { previews, preview, release, log, polls, opened } = setUp();
      polls.push(STARTING, RUNNING);
      preview.run();
      release();
      log.length = 0;

      const later = previews.runFor('me/app');
      const releaseLater = later.watch();
      expect(later.status()).toEqual(STARTING);
      expect(log).toEqual([]);

      vi.advanceTimersByTime(STATUS_POLL_MS * 2);
      expect(later.status()).toEqual(RUNNING);
      expect(opened()).toEqual([OPENS_SITE]);

      releaseLater();
      polls.push(RUNNING);
      previews.runFor('me/app').watch();
      vi.advanceTimersByTime(RUNNING_POLL_MS * 2);
      expect(opened()).toEqual([OPENS_SITE]);
    });

    it('opens the site once, when it answers, with no screen showing the project', () => {
      const { preview, release, polls, opened } = setUp();
      polls.push(STARTING, RUNNING);
      preview.run();
      release();

      vi.advanceTimersByTime(STATUS_POLL_MS * 2);

      expect(preview.status()).toEqual(RUNNING);
      expect(opened()).toEqual([OPENS_SITE]);
    });

    it('asks no more once nothing shows a project that is not starting', () => {
      const { preview, release, log, polls } = setUp({ first: RUNNING });
      log.length = 0;

      release();
      polls.push(RUNNING);
      vi.advanceTimersByTime(RUNNING_POLL_MS * 3);

      expect(log).toEqual([]);
      expect(preview.status()).toEqual(RUNNING);
    });

    it('asks no more once a start nothing shows has been answered', () => {
      const { preview, release, log, polls } = setUp();
      polls.push(STARTING, RUNNING);
      preview.run();
      release();
      vi.advanceTimersByTime(STATUS_POLL_MS * 2);
      log.length = 0;

      vi.advanceTimersByTime(RUNNING_POLL_MS * 3);

      expect(log).toEqual([]);
    });

    it('keeps asking while one of two screens still shows the project', () => {
      const { previews, preview, release, log, polls } = setUp({ first: RUNNING });
      const releaseSecond = previews.runFor('me/app').watch();
      release();
      log.length = 0;
      polls.push(RUNNING);

      vi.advanceTimersByTime(RUNNING_POLL_MS);

      expect(log).toEqual(['status me/app']);
      releaseSecond();
      releaseSecond();
      log.length = 0;
      vi.advanceTimersByTime(RUNNING_POLL_MS * 3);
      expect(log).toEqual([]);
      expect(preview.status()).toEqual(RUNNING);
    });

    it('reads the server again when a screen shows a project nothing was following', () => {
      const { previews, release, log, polls } = setUp({ first: RUNNING });
      release();
      log.length = 0;
      polls.push(STOPPED);

      const later = previews.runFor('me/app');
      later.watch();

      expect(log).toEqual(['status me/app']);
      expect(later.status()).toEqual(STOPPED);
    });

    it('keeps the blocked-tab note when another screen starts showing the project', () => {
      const { previews, preview, release, polls } = setUp({ start: RUNNING, blocksTabs: true });
      preview.run();
      release();
      polls.push(RUNNING);

      const later = previews.runFor('me/app');
      later.watch();

      expect(later.isTabBlocked()).toBe(true);
    });

    it('lets a Stop that nothing shows any more finish', () => {
      const { preview, release, polls, log } = setUp({ first: RUNNING, stopTakes: 500 });
      polls.push(RUNNING);

      preview.stop();
      release();
      vi.advanceTimersByTime(500);

      expect(preview.status()).toEqual(STOPPED);
      log.length = 0;
      vi.advanceTimersByTime(RUNNING_POLL_MS * 3);
      expect(log).toEqual([]);
    });

    it('keeps projects apart: one project starting does not touch another', () => {
      const { previews, log } = setUp();
      const other = previews.runFor('me/other');
      other.watch();
      previews.runFor('me/app').run();

      expect(other.status()).toEqual(STOPPED);
      expect(log).toEqual(['status me/other', 'start me/app']);
    });
  });
});
