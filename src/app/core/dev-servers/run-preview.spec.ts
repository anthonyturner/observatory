import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { DEV_SERVER_API, DevServerApi } from './dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from './dev-server.types';
import { PREVIEW_TABS } from './preview-tab';
import { RunPreview, STATUS_POLL_MS } from './run-preview';

const RUNNING: DevServerStatus = { state: 'running', url: 'http://localhost:5173/' };

/** A preview already watching `me/app`, where the server first reads as `first`. */
function setUp(answers: { start?: DevServerStatus; first?: DevServerStatus } = {}) {
  const { start = STARTING, first = STOPPED } = answers;
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
      return of(STOPPED);
    },
  };
  TestBed.configureTestingModule({
    providers: [
      RunPreview,
      { provide: DEV_SERVER_API, useValue: api },
      {
        provide: PREVIEW_TABS,
        useValue: {
          open: () => {
            log.push('open tab');
            return {
              show: (url: string) => log.push(`tab shows ${url}`),
              close: () => log.push('tab closed'),
            };
          },
        },
      },
    ],
  });
  const preview = TestBed.inject(RunPreview);
  preview.watch('me/app');
  const watched = [...log];
  log.length = 0;
  return { preview, log, polls, watched };
}

describe('RunPreview', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a server that is already running, without opening a tab', () => {
    const { preview, watched } = setUp({ first: RUNNING });

    expect(preview.status()).toEqual(RUNNING);
    expect(watched).toEqual(['status me/app']);
  });

  it('opens the tab at the click, then points it at the site once the server reports one', () => {
    const { preview, log, polls } = setUp();
    polls.push(STARTING, RUNNING);

    preview.run();

    expect(log).toEqual(['open tab', 'start me/app']);
    expect(preview.status()).toEqual(STARTING);

    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(preview.status()).toEqual(STARTING);
    expect(log).not.toContain('tab shows http://localhost:5173/');

    vi.advanceTimersByTime(STATUS_POLL_MS);
    expect(preview.status()).toEqual(RUNNING);
    expect(log).toEqual([
      'open tab',
      'start me/app',
      'status me/app',
      'status me/app',
      'tab shows http://localhost:5173/',
    ]);
  });

  it('stops asking once the server is up', () => {
    const { preview, log, polls } = setUp();
    polls.push(RUNNING);
    preview.run();
    vi.advanceTimersByTime(STATUS_POLL_MS);
    log.length = 0;

    vi.advanceTimersByTime(STATUS_POLL_MS * 5);

    expect(log).toEqual([]);
  });

  it('opens the site at once when the server was already running', () => {
    const { preview, log } = setUp({ start: RUNNING });

    preview.run();

    expect(log).toEqual(['open tab', 'start me/app', 'tab shows http://localhost:5173/']);
    expect(preview.status()).toEqual(RUNNING);
  });

  it('closes the tab and says why when the server could not start', () => {
    const failed: DevServerStatus = { state: 'failed', reason: 'No script.' };
    const { preview, log } = setUp({ start: failed });

    preview.run();

    expect(preview.status()).toEqual(failed);
    expect(log).toEqual(['open tab', 'start me/app', 'tab closed']);
  });

  it('closes the tab and says why when the server ends while it is starting', () => {
    const failed: DevServerStatus = { state: 'failed', reason: 'It exited.' };
    const { preview, log, polls } = setUp();
    polls.push(failed);

    preview.run();
    vi.advanceTimersByTime(STATUS_POLL_MS);

    expect(preview.status()).toEqual(failed);
    expect(log.at(-1)).toBe('tab closed');
  });

  it('stops the server, and the tab waiting for it, and the polling', () => {
    const { preview, log } = setUp();
    preview.run();
    log.length = 0;

    preview.stop();
    vi.advanceTimersByTime(STATUS_POLL_MS * 3);

    expect(preview.status()).toEqual(STOPPED);
    expect(log).toEqual(['stop me/app', 'tab closed']);
  });

  it('stops polling when its owner goes', () => {
    const { preview, log } = setUp();
    preview.run();
    log.length = 0;

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(STATUS_POLL_MS * 3);

    expect(log).toEqual(['tab closed']);
    expect(preview.status()).toEqual(STARTING);
  });
});
