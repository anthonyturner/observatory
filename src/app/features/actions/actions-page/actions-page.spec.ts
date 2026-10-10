import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ViewerSession } from '../../../core/session/viewer-session';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { ActionsPage } from './actions-page';
import { ciHealthWords } from '../actions-words';
import { actionsStamp, emptyMessage, quietWorkflowsNote } from './actions-page-words';
import {
  ACTIONS_NOW,
  actionsReport,
  actionsRun,
} from '../../../core/actions/testing/actions-fixture';

const run = (id: number, outcome: string, more: object = {}) => ({
  id,
  workflowId: 9,
  workflow: 'CI',
  title: `Change ${id}`,
  number: id,
  attempt: 1,
  event: 'push',
  branch: 'main',
  sha: 'a'.repeat(40),
  actor: 'me',
  createdAt: '2026-10-07T10:00:00Z',
  startedAt: '2026-10-07T10:00:00Z',
  durationS: 120,
  outcome,
  isFlaky: false,
  url: `https://github.com/me/app/actions/runs/${id}`,
  ...more,
});

const REPORT = {
  generatedAt: '2026-10-07T11:00:00Z',
  repo: 'me/app',
  workflows: [],
  runs: [run(2, 'passed'), run(1, 'failed', { branch: 'feat/x' })],
  flakyChecks: [],
  health: { repo: 'me/app', branch: 'main', state: 'failing', failing: ['CI'] },
};

const JOBS = {
  repo: 'me/app',
  runId: 1,
  jobs: [
    {
      id: 5,
      name: 'test',
      outcome: 'failed',
      durationS: 60,
      url: 'https://github.com/me/app/actions/runs/1/job/5',
      steps: [
        {
          number: 3,
          name: 'Test',
          outcome: 'failed',
          url: 'https://github.com/me/app/actions/runs/1/job/5#step:3:1',
        },
      ],
    },
  ],
};

function render(canWrite: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ owner: 'me', repo: 'app' })) },
      },
      { provide: ELEMENT_SIZE, useValue: () => of({ width: 1400, height: 900 }) },
      { provide: PlanetPortraits, useValue: { painter: () => signal(null) } },
      {
        provide: ViewerSession,
        useValue: { canWrite: signal(canWrite), isConfirmedLocal: signal(false) },
      },
    ],
  });
  const fixture = TestBed.createComponent(ActionsPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne('/api/actions?repo=me/app').flush(REPORT);
  fixture.detectChanges();
  http.expectOne('/api/actions/run?repo=me/app&run=1').flush(JOBS);
  fixture.detectChanges();
  return { fixture, http, element: fixture.nativeElement as HTMLElement };
}

describe('ActionsPage', () => {
  it('opens on the newest failure with its failed steps linked, under the Actions tab', () => {
    const { element } = render(true);

    expect(element.querySelector('h1')?.textContent).toBe('Actions');
    expect(element.querySelector('.health')?.textContent).toContain('main is failing (CI)');
    expect(
      element.querySelector('app-project-tabs a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/p/me/app/actions');
    expect(element.querySelector('app-run-detail h2')?.textContent).toBe('Change 1');
    expect(element.querySelector('.steps a')?.getAttribute('href')).toBe(
      'https://github.com/me/app/actions/runs/1/job/5#step:3:1',
    );
    expect(element.querySelector('.rerun__send')?.textContent).toContain('Rerun failed jobs');
  });

  it('shows a preview visitor no rerun button', () => {
    const { element } = render(false);

    expect(element.querySelector('app-run-detail')).not.toBeNull();
    expect(element.querySelector('.rerun__send')).toBeNull();
  });

  it('narrows the runs by branch, in the list too', () => {
    const { fixture, element } = render(true);
    const [, branch] = element.querySelectorAll<HTMLSelectElement>('.filters select');
    branch.value = 'main';
    branch.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    element.querySelectorAll<HTMLButtonElement>('.views button')[1].click();
    fixture.detectChanges();

    expect([...element.querySelectorAll('app-run-list b')].map((b) => b.textContent)).toEqual([
      'Change 2',
    ]);
    expect(element.querySelector('.stamp')?.textContent).toBe('me/app · 1 of 2 runs');
  });
});

describe('Actions page words', () => {
  it('says what the header and an empty sky say', () => {
    const report = actionsReport([actionsRun(1, 5)]);

    expect(actionsStamp('me/app', report, 1)).toBe('me/app · 1 run');
    expect(emptyMessage(report, 0)?.headline).toBe('No runs match');
    expect(emptyMessage(actionsReport([]), 0)?.headline).toBe('No workflow runs yet');
    expect(emptyMessage(report, 1)).toBeNull();
    expect(ciHealthWords({ repo: 'me/app', branch: 'main', state: 'none', failing: [] })).toBe(
      'main has no runs yet',
    );
    expect(ACTIONS_NOW).toBe(report.generatedAt);
  });

  it('names the workflows switched on that have no recent run', () => {
    const workflow = (id: number, name: string, isActive = true) => ({
      id,
      name,
      isActive,
      url: 'https://github.com/me/app/actions',
    });
    const report = {
      ...actionsReport([actionsRun(1, 5)]),
      workflows: [workflow(9, 'CI'), workflow(10, 'Nightly'), workflow(11, 'Old', false)],
    };

    expect(quietWorkflowsNote(report)).toBe('No recent runs: Nightly');
    expect(quietWorkflowsNote(actionsReport([actionsRun(1, 5)]))).toBeNull();
  });
});
