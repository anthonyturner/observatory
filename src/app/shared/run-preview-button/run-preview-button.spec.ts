import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DEV_SERVER_API, DevServerApi } from '../../core/dev-servers/dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from '../../core/dev-servers/dev-server.types';
import { PREVIEW_TABS } from '../../core/dev-servers/preview-tab';
import { STATUS_POLL_MS } from '../../core/dev-servers/run-preview';
import { ViewerSession } from '../../core/session/viewer-session';
import { RunPreviewButton } from './run-preview-button';

const RUNNING: DevServerStatus = { state: 'running', url: 'http://localhost:5173/' };

function setUp(options: { isLocal?: boolean; status?: DevServerStatus; start?: DevServerStatus }) {
  const { isLocal = true, status = STOPPED, start = STARTING } = options;
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
        provide: PREVIEW_TABS,
        useValue: { open: () => ({ show: () => undefined, close: () => undefined }) },
      },
    ],
  });
  const fixture = TestBed.createComponent(RunPreviewButton);
  fixture.componentRef.setInput('repo', 'me/app');
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const settle = (): void => {
    TestBed.tick();
    fixture.detectChanges();
  };
  const labels = (): string[] =>
    Array.from(element.querySelectorAll('button, a')).map((each) => each.textContent?.trim() ?? '');
  return { fixture, element, calls, polls, isConfirmedLocal, settle, labels };
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
    expect(calls[0]).toBe('status');
    expect(calls[1]).toBe('start');
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
});
