import { ActionsReport, ActionsRun } from '../actions-report';

/** 11:00 UTC on 7 October 2026: when the fixture report was made. */
export const ACTIONS_NOW = Date.parse('2026-10-07T11:00:00Z');
const MINUTE = 60_000;

/** A passed CI run on main that started `minutesAgo` before ACTIONS_NOW, with any field replaced. */
export function actionsRun(
  id: number,
  minutesAgo: number,
  more: Partial<ActionsRun> = {},
): ActionsRun {
  const at = ACTIONS_NOW - minutesAgo * MINUTE;
  return {
    id,
    workflowId: 9,
    workflow: 'CI',
    title: `Change ${id}`,
    number: id,
    attempt: 1,
    event: 'push',
    branch: 'main',
    actor: 'me',
    createdAt: at,
    startedAt: at,
    durationS: 150,
    outcome: 'passed',
    isFlaky: false,
    url: `https://github.com/me/app/actions/runs/${id}`,
    ...more,
  };
}

export function actionsReport(runs: readonly ActionsRun[]): ActionsReport {
  return {
    generatedAt: ACTIONS_NOW,
    repo: 'me/app',
    workflows: [],
    runs,
    flakyChecks: [],
    health: { repo: 'me/app', branch: 'main', state: 'passing', failing: [] },
  };
}
