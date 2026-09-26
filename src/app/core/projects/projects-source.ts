import { InjectionToken, Signal, signal } from '@angular/core';
import { ProjectSnapshot } from './project.types';

const SAMPLE_PROJECTS: readonly ProjectSnapshot[] = [
  {
    name: 'pr-starmap',
    repo: 'anthonyturner/pr-starmap',
    dashboardUrl: '/p/anthonyturner/pr-starmap',
    open: 6,
    issues: 9,
    oldestIdleDays: 4,
    counts: { conflicted: 1, failing: 2, unknown: 0, unlinked: 1, unreviewed: 3, unclaimed: 2 },
  },
  {
    name: 'observatory',
    repo: 'anthonyturner/observatory',
    dashboardUrl: '/p/anthonyturner/observatory',
    open: 1,
    issues: 4,
    counts: { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 1, unclaimed: 3 },
  },
  {
    name: 'agent-playbook',
    repo: 'anthonyturner/agent-playbook',
    dashboardUrl: '/p/anthonyturner/agent-playbook',
    open: 3,
    issues: 2,
    oldestIdleDays: 9,
    counts: { conflicted: 0, failing: 0, unknown: 2, unlinked: 1, unreviewed: 0, unclaimed: 0 },
  },
  {
    name: 'agent-speak',
    repo: 'anthonyturner/agent-speak',
    dashboardUrl: '/p/anthonyturner/agent-speak',
    open: 0,
    issues: 1,
    counts: { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 },
  },
  {
    name: 'overwolf',
    repo: 'anthonyturner/overwolf',
    dashboardUrl: '/p/anthonyturner/overwolf',
    open: 0,
    error: 'GitHub rate limit reached; try again in a few minutes.',
    counts: { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 },
  },
];

/** Every tracked project: sample data until the live source lands. */
export const PROJECTS = new InjectionToken<Signal<readonly ProjectSnapshot[]>>('PROJECTS', {
  providedIn: 'root',
  factory: () => signal(SAMPLE_PROJECTS).asReadonly(),
});
