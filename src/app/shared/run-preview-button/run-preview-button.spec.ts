import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DEV_SERVER_API, DevServerApi } from '../../core/dev-servers/dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from '../../core/dev-servers/dev-server.types';
import { RUNNING_POLL_MS, STATUS_POLL_MS } from '../../core/dev-servers/run-preview';
import { SITE_OPENER } from '../../core/dev-servers/site-opener';
import { ViewerSession } from '../../core/session/viewer-session';
import { RunPreviewButton } from './run-preview-button';

const RUNNING: DevServerStatus = { state: 'running', url: 'http://localhost:5173/' };

function setUp(options: {
  isLocal?: boolean;
  status?: DevServerStatus;
  start?: DevServerStatus;
  blocksTabs?: boolean;
}) {
  const { isLocal = true, status = STOPPED, start = STARTING, blocksTabs = false } = options;
  const calls: string[] = [];
  const polls: DevServerStatus[] = [];
  const api: DevServerApi = {
    status: () => {
      calls.push('status');
      return of(polls.shift() ?? status);
    },
    start: () => {
      calls.push('start');
      return of(start);
    },
    stop: () => {
      calls.push('stop');
      return of(STOPPED);
    },
  };
  const isConfirmedLocal = signal(isLocal);
  TestBed.configureTestingModule({
    providers: [
      { provide: ViewerSession, useValue: { isConfirmedLocal } },
      { provide: DEV_SERVER_API, useValue: api },
      {
        provide: SITE_OPENER,
        useValue: {
          open: (url: string) => {
            calls.push(`opens ${url}`);
            return !blocksTabs;
          },
        },
      },
    ],
  });
  const mount = (repo: string) => {
    const fixture = TestBed.createComponent(RunPreviewButton);
    fixture.componentRef.setInput('repo', repo);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const settle = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    const labels = (): string[] =>
      Array.from(element.querySelectorAll('button, a')).map(
        (each) => each.textContent?.trim() ?? '',
      );
    return { fixture, element, settle, labels };
  };
  return { ...mount('me/app'), mount, calls, polls, isConfirmedLocal };
}

describe('RunPreviewButton', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is not there, and asks for nothing, unless the API has confirmed this machine', () => {
    const { element, calls, isConfirmedLocal, settle } = setUp({ isLocal: false });

    expect(element.querySelector('button, a, [role="status"]')).toBeNull();
    expect(element.children.length).toBe(0);
    expect(calls).toEqual([]);

    isConfirmedLocal.set(true);
    settle();

    expect(element.querySelector('button')).not.toBeNull();
    expect(calls).toEqual(['status']);
  });

  it('offers Run for a project whose server is not running', () => {
    const { labels, element } = setUp({});

    expect(labels()).toEqual(['▶ Run']);
    expect(element.querySelector('button')?.getAttribute('aria-label')).toBe('Run me/app');
  });

  it('goes from Run to Starting, with Stop, to Open once the server reports its address', () => {
    const { labels, element, calls, polls, settle } = setUp({});
    polls.push(STARTING, RUNNING);

    element.querySelector('button')?.click();
    settle();
    expect(labels()).toEqual(['Starting…', '■ Stop']);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Starting');

    vi.advanceTimersByTime(STATUS_POLL_MS * 2);
    settle();

    expect(labels()).toEqual(['Open ↗', '■ Stop']);
    const open = element.querySelector('a');
    expect(open?.getAttribute('href')).toBe('http://localhost:5173/');
    expect(open?.getAttribute('target')).toBe('_blank');
    expect(open?.getAttribute('rel')).toContain('noopener');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('localhost:5173');
    expect(calls).toEqual(['status', 'start', 'status', 'status', 'opens http://localhost:5173/']);
  });

  it('opens no tab at the click', () => {
    const { calls, element, settle } = setUp({});

    element.querySelector('button')?.click();
    settle();

    expect(calls).toEqual(['status', 'start']);
  });

  it('keeps Open and says how to allow pop-ups when the browser blocked the tab', () => {
    const { labels, element, settle } = setUp({ start: RUNNING, blocksTabs: true });

    element.querySelector('button')?.click();
    settle();

    expect(labels()).toEqual(['Open ↗', '■ Stop']);
    expect(element.querySelector('a')?.getAttribute('href')).toBe('http://localhost:5173/');
    expect(element.querySelector('[role="status"]')?.textContent).toBe(
      'Your browser blocked the new tab — allow pop-ups for Observatory to open sites automatically.',
    );
  });

  it('drops the pop-up note once Open is clicked', () => {
    const { element, settle } = setUp({ start: RUNNING, blocksTabs: true });
    element.querySelector('button')?.click();
    settle();

    element.querySelector('a')?.click();
    settle();

    expect(element.querySelector('[role="status"]')?.textContent).toContain('localhost:5173');
  });

  it('shows a server that was already running as Open and Stop, and Stop puts Run back', () => {
    const { labels, element, settle, calls } = setUp({ status: RUNNING });
    expect(labels()).toEqual(['Open ↗', '■ Stop']);

    element.querySelector('button')?.click();
    settle();

    expect(calls).toContain('stop');
    expect(labels()).toEqual(['▶ Run']);
  });

  it('says why a project could not be run, and offers Run again', () => {
    const reason = 'There is no local checkout of this project on this machine.';
    const { labels, element, settle } = setUp({ start: { state: 'failed', reason } });

    element.querySelector('button')?.click();
    settle();

    expect(labels()).toEqual(['▶ Run']);
    const note = element.querySelector('[role="status"]');
    expect(note?.textContent).toBe(reason);
    expect(note?.classList.contains('problem')).toBe(true);
  });

  it('shows the same state on two buttons for one project, and drives it from either', () => {
    const { labels, element, settle, mount } = setUp({});
    const second = mount('me/app');

    element.querySelector('button')?.click();
    settle();
    second.settle();

    expect(labels()).toEqual(['Starting…', '■ Stop']);
    expect(second.labels()).toEqual(['Starting…', '■ Stop']);

    second.element.querySelectorAll('button')[1]?.click();
    settle();
    second.settle();

    expect(labels()).toEqual(['▶ Run']);
    expect(second.labels()).toEqual(['▶ Run']);
  });

  it('keeps projects apart', () => {
    const { labels, element, settle, mount } = setUp({});
    const other = mount('me/other');

    element.querySelector('button')?.click();
    settle();
    other.settle();

    expect(labels()).toEqual(['Starting…', '■ Stop']);
    expect(other.labels()).toEqual(['▶ Run']);
  });

  it('carries a start on to a button mounted after the one that began it is gone, and opens the site once', () => {
    const { fixture, element, calls, polls, mount, settle } = setUp({});
    polls.push(STARTING, RUNNING);
    element.querySelector('button')?.click();
    settle();
    fixture.destroy();
    calls.length = 0;

    const later = mount('me/app');
    expect(later.labels()).toEqual(['Starting…', '■ Stop']);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(STATUS_POLL_MS * 2);
    later.settle();

    expect(later.labels()).toEqual(['Open ↗', '■ Stop']);
    expect(calls.filter((call) => call.startsWith('opens'))).toEqual([
      'opens http://localhost:5173/',
    ]);
  });

  it('asks no more once its last button is gone and the server is up', () => {
    const { fixture, calls, polls } = setUp({ status: RUNNING });
    fixture.destroy();
    calls.length = 0;
    polls.push(RUNNING);

    vi.advanceTimersByTime(RUNNING_POLL_MS * 3);

    expect(calls).toEqual([]);
  });
});
