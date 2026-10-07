import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BROWSER_NOTICES } from '../../../core/agent-usage/browser-notices';
import { FakeBrowserNotices } from '../../../core/agent-usage/testing/fake-browser-notices';
import { ProjectJump } from '../../../core/projects/project-jump';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { FleetSection } from './fleet-section';

const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, failing = 0): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: 0,
  counts: { ...quiet, failing },
});
const ready = (projects: readonly ProjectSnapshot[]): ProjectsState => ({
  status: 'ready',
  report: { generatedAt: '2026-09-26T12:00:00Z', projects, directives: [] },
});

function render(state: ProjectsState): HTMLElement {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PROJECTS_STATE, useValue: signal(state) },
    ],
  });
  const fixture = TestBed.createComponent(FleetSection);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FleetSection', () => {
  it('puts blocked projects first and sums them up', () => {
    const element = render(ready([project('calm'), project('stuck', 2)]));

    const names = Array.from(element.querySelectorAll('.name a')).map((a) => a.textContent?.trim());
    expect(names).toEqual(['stuck', 'calm']);
    expect(element.querySelector('.sum')?.textContent).toBe('1 blocked · 1 clear');
  });

  it('says it is reading, and shows no cards, before the first read', () => {
    const element = render({ status: 'reading' });

    expect(element.querySelector('.empty')?.textContent).toContain('Reading your projects');
    expect(element.querySelector('app-project-card')).toBeNull();
  });

  it('says the projects are out of reach rather than showing none', () => {
    expect(render({ status: 'unreachable' }).querySelector('.empty')?.textContent).toContain(
      'out of reach',
    );
  });

  it('says so when the account owns no repositories', () => {
    expect(render(ready([])).querySelector('.empty')?.textContent).toContain('No projects yet');
  });

  describe('Notify me', () => {
    const BLOCKED =
      'Blocked by the browser. Allow notifications for this site in its settings, then tick again.';

    beforeEach(() => {
      localStorage.clear();
      vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    function renderWith(notices: FakeBrowserNotices) {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: PROJECTS_STATE, useValue: signal(ready([project('calm')])) },
          { provide: BROWSER_NOTICES, useValue: notices },
        ],
      });
      const fixture = TestBed.createComponent(FleetSection);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      const box = element.querySelector<HTMLInputElement>('#projects-notify');
      if (!box) throw new Error('No Notify me box');
      const status = (): string =>
        element.querySelector('[role="status"].blocked')?.textContent?.trim() ?? '';
      /** Lets the browser answer and the status line be written, then draws. */
      const settle = async (): Promise<void> => {
        await vi.advanceTimersByTimeAsync(1_000);
        fixture.detectChanges();
      };
      const tick = async (): Promise<void> => {
        box.click();
        await settle();
      };
      return { fixture, element, box, status, tick, settle };
    }

    it('sits in the head, in a group for project notifications, off at first', () => {
      const { element, box } = renderWith(new FakeBrowserNotices('default'));

      const group = element.querySelector('.head [role="group"]');
      expect(group?.getAttribute('aria-label')).toBe('Project notifications');
      expect(group?.contains(box)).toBe(true);
      expect(box.closest('label')?.textContent?.trim()).toBe('Notify me');
      expect(box.checked).toBe(false);
      expect(element.querySelector('.blocked')?.matches(':empty')).toBe(true);
    });

    it('stays ticked when the browser allows it, and is still ticked on a later visit', async () => {
      const notices = new FakeBrowserNotices('default', 'granted');
      const { box, status, tick } = renderWith(notices);

      await tick();
      expect(notices.requests).toBe(1);
      expect(box.checked).toBe(true);
      expect(status()).toBe('');

      TestBed.resetTestingModule();
      expect(renderWith(new FakeBrowserNotices('granted')).box.checked).toBe(true);
    });

    it('goes back to unticked, saying how to allow it, when the owner refuses', async () => {
      const { box, status, tick } = renderWith(new FakeBrowserNotices('default', 'denied'));

      await tick();

      expect(box.checked).toBe(false);
      expect(status()).toBe(BLOCKED);
    });

    it('goes back to unticked, saying how to allow it, when the browser already blocks it', async () => {
      const notices = new FakeBrowserNotices('denied');
      const { box, status, tick } = renderWith(notices);

      await tick();

      expect(notices.requests).toBe(0);
      expect(box.checked).toBe(false);
      expect(status()).toBe(BLOCKED);
    });

    it('empties the line and writes it again when ticked after a refusal, so it is heard again', async () => {
      const { fixture, box, status, tick, settle } = renderWith(new FakeBrowserNotices('denied'));
      await tick();

      box.click();
      fixture.detectChanges();
      expect(status()).toBe('');

      await settle();
      expect(box.checked).toBe(false);
      expect(status()).toBe(BLOCKED);
    });

    it('turns off when unticked', async () => {
      const { box, tick } = renderWith(new FakeBrowserNotices('default', 'granted'));
      await tick();

      await tick();

      expect(box.checked).toBe(false);
      expect(localStorage.getItem('observatory.project-notify')).toBe('off');
    });

    it('is disabled where the browser has no notifications', () => {
      expect(renderWith(new FakeBrowserNotices('unsupported')).box.disabled).toBe(true);
    });

    it('shows unticked once permission is taken back in the browser’s settings', () => {
      localStorage.setItem('observatory.project-notify', 'on');

      expect(renderWith(new FakeBrowserNotices('denied')).box.checked).toBe(false);
    });
  });

  it('brings the project Home was opened for into view, once its card is there', async () => {
    const state = signal<ProjectsState>({ status: 'reading' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PROJECTS_STATE, useValue: state },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ project: 'me/stuck' }) } },
        },
      ],
    });
    const jumpTo = vi
      .spyOn(TestBed.inject(ProjectJump), 'jumpTo')
      .mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(FleetSection);
    fixture.detectChanges();
    expect(jumpTo).not.toHaveBeenCalled();

    state.set(ready([project('calm'), project('stuck', 2)]));
    await fixture.whenStable();

    expect(jumpTo).toHaveBeenCalledExactlyOnceWith('me/stuck');
  });
});
