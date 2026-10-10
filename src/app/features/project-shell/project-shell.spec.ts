import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { LiveSites } from '../../core/deployments/live-sites';
import { DEV_SERVER_API, DevServerApi } from '../../core/dev-servers/dev-server-api';
import { DevServerStatus, STARTING, STOPPED } from '../../core/dev-servers/dev-server.types';
import { RunPreviews, STATUS_POLL_MS } from '../../core/dev-servers/run-preview';
import { SITE_OPENER } from '../../core/dev-servers/site-opener';
import { libraryMatcher } from '../../core/library/library-route';
import { ViewerSession } from '../../core/session/viewer-session';
import { ELEMENT_SIZE } from '../../shared/element-size/element-size';
import { QUIET_TABS } from '../../shared/project-tabs/quiet-tabs';
import { ProjectShell } from './project-shell';

const RUNNING: DevServerStatus = { state: 'running', url: 'http://localhost:5173/' };

@Component({ selector: 'app-queue-page', template: '<p>queue page</p>' })
class QueuePage {}
@Component({ selector: 'app-releases-page', template: '<p>releases page</p>' })
class ReleasesPage {}
@Component({ selector: 'app-journal-page', template: '<p>journal page</p>' })
class JournalPage {}
@Component({ selector: 'app-library-page', template: '<p>library page</p>' })
class LibraryPage {}

const ROUTES: Routes = [
  {
    path: 'p/:owner/:repo',
    component: ProjectShell,
    children: [
      { path: '', pathMatch: 'full', component: QueuePage },
      { path: 'releases', component: ReleasesPage },
      { path: 'journal', component: JournalPage },
      { matcher: libraryMatcher, component: LibraryPage },
    ],
  },
];

async function setUp() {
  const opened: string[] = [];
  const serverIsUp = signal(false);
  let hasStarted = false;
  const api: DevServerApi = {
    status: () => of(hasStarted ? (serverIsUp() ? RUNNING : STARTING) : STOPPED),
    start: () => {
      hasStarted = true;
      return of(STARTING);
    },
    stop: () => of(STOPPED),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(ROUTES),
      {
        provide: ViewerSession,
        useValue: { isConfirmedLocal: signal(true), isConfirmedHosted: signal(false) },
      },
      { provide: LiveSites, useValue: { load: () => undefined, urlFor: () => null } },
      { provide: DEV_SERVER_API, useValue: api },
      {
        provide: SITE_OPENER,
        useValue: {
          open: (url: string) => {
            opened.push(url);
            return true;
          },
        },
      },
      { provide: QUIET_TABS, useValue: [] },
      { provide: ELEMENT_SIZE, useValue: () => of({ width: 480, height: 28 }) },
    ],
  });
  const harness = await RouterTestingHarness.create('/p/me/app/releases');
  const root = harness.fixture as ComponentFixture<unknown>;
  const element = root.nativeElement as HTMLElement;
  const settle = (): void => {
    TestBed.tick();
    root.detectChanges();
  };
  const runPreview = () => TestBed.inject(RunPreviews).runFor('me/app');
  const currentTab = (): string | null | undefined =>
    element.querySelector('app-project-tabs a[aria-current="page"]')?.getAttribute('href');
  return { harness, element, opened, serverIsUp, settle, runPreview, currentTab };
}

describe('ProjectShell', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('marks the screen below it as the page, and points the Guide link at its part', async () => {
    const { harness, element, currentTab, settle } = await setUp();
    settle();

    expect(currentTab()).toBe('/p/me/app/releases');
    expect(element.querySelector('app-up-link a.guide')?.getAttribute('href')).toContain(
      'releases',
    );

    await harness.navigateByUrl('/p/me/app');
    settle();
    expect(currentTab()).toBe('/p/me/app');
    expect(element.querySelector('app-up-link a.guide')?.getAttribute('href')).toContain(
      'review-queue',
    );

    await harness.navigateByUrl('/p/me/app/library/docs/stack');
    settle();
    expect(currentTab()).toBe('/p/me/app/library');
  });

  it('keeps one Run button, and the server it is starting, across tab switches', async () => {
    const { harness, element, opened, serverIsUp, settle, runPreview } = await setUp();
    settle();
    const button = element.querySelector('app-run-preview-button');
    const preview = runPreview();

    element.querySelector<HTMLButtonElement>('app-run-preview-button button')?.click();
    settle();
    expect(preview.status()).toEqual(STARTING);

    await harness.navigateByUrl('/p/me/app/journal');
    settle();
    expect(element.textContent).toContain('journal page');
    expect(element.querySelector('app-run-preview-button')).toBe(button);
    expect(runPreview()).toBe(preview);
    expect(preview.status()).toEqual(STARTING);

    serverIsUp.set(true);
    vi.advanceTimersByTime(STATUS_POLL_MS);
    settle();

    expect(preview.status()).toEqual(RUNNING);
    expect(opened).toEqual(['http://localhost:5173/']);
  });

  it('publishes the bar’s size for the screens to leave room for, until it goes', async () => {
    const { harness, settle } = await setUp();
    const root = document.documentElement.style;
    settle();

    expect([
      root.getPropertyValue('--project-bar-width'),
      root.getPropertyValue('--project-bar-height'),
    ]).toEqual(['480px', '28px']);

    await harness.navigateByUrl('/');
    settle();

    expect([
      root.getPropertyValue('--project-bar-width'),
      root.getPropertyValue('--project-bar-height'),
    ]).toEqual(['', '']);
  });
});
