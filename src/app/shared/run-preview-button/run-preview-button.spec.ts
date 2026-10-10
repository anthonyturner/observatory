import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { LiveSites } from '../../core/deployments/live-sites';
import { DEV_SERVER_API, DevServerApi } from '../../core/dev-servers/dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from '../../core/dev-servers/dev-server.types';
import { RUNNING_POLL_MS, STATUS_POLL_MS } from '../../core/dev-servers/run-preview';
import { SITE_OPENER } from '../../core/dev-servers/site-opener';
import { ViewerSession } from '../../core/session/viewer-session';
import { RunPreviewButton } from './run-preview-button';

const RUNNING: DevServerStatus = { state: 'running', url: 'http://localhost:5173/' };
const NO_CHECKOUT: DevServerStatus = {
  state: 'unavailable',
  reason: 'There is no local checkout of this project on this machine.',
};
const LIVE = 'https://app.example.com';

function setUp(options: {
  isLocal?: boolean;
  isHosted?: boolean;
  /** Whether the API has yet to answer the first status read. */
  isUnanswered?: boolean;
  /** The production site of `me/app`, once the sites are read. */
  liveUrl?: string | null;
  status?: DevServerStatus;
  start?: DevServerStatus;
  blocksTabs?: boolean;
}) {
  const {
    isLocal = true,
    isHosted = false,
    isUnanswered = false,
    liveUrl = null,
    status = STOPPED,
    start = STARTING,
    blocksTabs = false,
  } = options;
  const calls: string[] = [];
  const asked: string[] = [];
  const polls: DevServerStatus[] = [];
  const api: DevServerApi = {
    status: (repo) => {
      calls.push('status');
      asked.push(repo);
      return isUnanswered ? NEVER : of(polls.shift() ?? status);
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
  const isConfirmedHosted = signal(isHosted);
  const liveSites = signal(liveUrl);
  TestBed.configureTestingModule({
    providers: [
      { provide: ViewerSession, useValue: { isConfirmedLocal, isConfirmedHosted } },
      {
        provide: LiveSites,
        useValue: {
          load: () => calls.push('load sites'),
          urlFor: (repo: string) => (repo === 'me/app' ? liveSites() : null),
        },
      },
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
  return { ...mount('me/app'), mount, calls, asked, polls, isConfirmedLocal, liveSites };
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

  it('moves to the new project, and lets go of the old one, when its repo changes', () => {
    const { fixture, labels, asked, settle } = setUp({ status: RUNNING });
    asked.length = 0;

    fixture.componentRef.setInput('repo', 'me/other');
    settle();
    expect(asked).toEqual(['me/other']);
    expect(labels()).toEqual(['Open ↗', '■ Stop']);

    vi.advanceTimersByTime(RUNNING_POLL_MS * 3);
    expect(new Set(asked)).toEqual(new Set(['me/other']));
  });

  it('lets go of the project when the machine stops being confirmed as the owner’s own', () => {
    const { element, asked, isConfirmedLocal, settle } = setUp({ status: RUNNING });
    asked.length = 0;

    isConfirmedLocal.set(false);
    settle();
    vi.advanceTimersByTime(RUNNING_POLL_MS * 3);

    expect(element.children.length).toBe(0);
    expect(asked).toEqual([]);
  });
});

describe('RunPreviewButton: Run or Live site', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const liveLink = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('a')).find((link) =>
      link.textContent?.includes('Live site'),
    );

  describe('on the owner’s machine, in a project with a checkout', () => {
    it('shows Run, and no Live site, whether or not the project has a production site', () => {
      for (const liveUrl of [LIVE, null]) {
        TestBed.resetTestingModule();
        const { labels, calls } = setUp({ liveUrl });

        expect(labels()).toEqual(['▶ Run']);
        expect(calls).not.toContain('load sites');
      }
    });

    it('keeps Run’s own Open link when its server is up, with no Live site beside it', () => {
      const { labels } = setUp({ status: RUNNING, liveUrl: LIVE });

      expect(labels()).toEqual(['Open ↗', '■ Stop']);
    });
  });

  describe('on the owner’s machine, in a project with no checkout', () => {
    it('shows Live site, and no Run, when the project has a production site', () => {
      const { labels, element } = setUp({ status: NO_CHECKOUT, liveUrl: LIVE });

      expect(labels()).toEqual(['Live site ↗']);
      const link = liveLink(element);
      expect(link?.getAttribute('href')).toBe(LIVE);
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toContain('noopener');
      expect(link?.getAttribute('aria-label')).toBe('Live site of me/app in a new tab');
    });

    it('shows nothing at all when it has none', () => {
      const { element, calls } = setUp({ status: NO_CHECKOUT, liveUrl: null });

      expect(element.children.length).toBe(0);
      expect(calls).toContain('load sites');
    });

    it('shows Live site once the sites are read', () => {
      const { labels, liveSites, settle } = setUp({ status: NO_CHECKOUT, liveUrl: null });
      expect(labels()).toEqual([]);

      liveSites.set(LIVE);
      settle();

      expect(labels()).toEqual(['Live site ↗']);
    });

    it('shows neither Run nor the link before the API has said whether there is a checkout', () => {
      const { element, calls } = setUp({ isUnanswered: true, liveUrl: LIVE });

      expect(element.children.length).toBe(0);
      expect(calls).toEqual(['status']);
    });
  });

  describe('on the hosted site, as its owner or a visitor', () => {
    it('shows Live site, and never asks for a dev server, when the project has a production site', () => {
      const { labels, element, calls } = setUp({ isLocal: false, isHosted: true, liveUrl: LIVE });

      expect(labels()).toEqual(['Live site ↗']);
      expect(liveLink(element)?.getAttribute('href')).toBe(LIVE);
      expect(calls).toEqual(['load sites']);
    });

    it('shows nothing at all when it has none', () => {
      const { element, calls } = setUp({ isLocal: false, isHosted: true, liveUrl: null });

      expect(element.children.length).toBe(0);
      expect(calls).toEqual(['load sites']);
    });
  });

  it('shows nothing, and reads no sites, until the API has said who is looking', () => {
    const { element, calls } = setUp({ isLocal: false, isHosted: false, liveUrl: LIVE });

    expect(element.children.length).toBe(0);
    expect(calls).toEqual([]);
  });
});
