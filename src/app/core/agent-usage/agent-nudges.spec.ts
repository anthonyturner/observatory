import {
  agentNudges,
  busyDayNudges,
  nearLimitNudges,
  pricierNudges,
  reworkNudges,
  skippedQaNudges,
} from './agent-nudges';
import { AGENT_NOW, runEndingAt } from './testing/agent-run-fixture';

/** AGENT_NOW is Wednesday noon; the week began Monday, 60 hours before. */
const THIS_WEEK = 10;
const LAST_WEEK = 80;

const full = (id: string, hoursAgo: number, agent = 'dev', peakContext = 170_000) =>
  runEndingAt(id, hoursAgo, 30, { agent, peakContext });

describe('near the limit', () => {
  it('nudges at three runs near the window this week, not two', () => {
    const two = [full('a', THIS_WEEK), full('b', THIS_WEEK)];

    expect(nearLimitNudges(two, AGENT_NOW)).toEqual([]);
    const [nudge] = nearLimitNudges([...two, full('c', THIS_WEEK)], AGENT_NOW);
    expect(nudge.text).toBe('dev ran near or past the 200k context window 3 times this week');
    expect(nudge.target).toEqual({ kind: 'chart', chart: 'context', agent: 'dev' });
  });

  it('leaves the pooled Other agents out', () => {
    const other = ['a', 'b', 'c'].map((id) => full(id, THIS_WEEK, 'Explore'));

    expect(nearLimitNudges(other, AGENT_NOW)).toEqual([]);
  });

  it('counts neither last week’s runs nor ones below 160k', () => {
    const runs = [
      full('a', THIS_WEEK),
      full('b', THIS_WEEK),
      full('c', LAST_WEEK),
      full('d', THIS_WEEK, 'dev', 159_999),
    ];

    expect(nearLimitNudges(runs, AGENT_NOW)).toEqual([]);
  });
});

describe('busy day', () => {
  it('nudges from twice a usual day, says how busy it really is, and not when unknown', () => {
    expect(busyDayNudges(1.95, '2026-09-30')).toEqual([]);
    expect(busyDayNudges(null, '2026-09-30')).toEqual([]);
    const [nudge] = busyDayNudges(2, '2026-09-30');
    expect(nudge.text).toBe('Busy day: 2× your usual Claude Code work so far');
    expect(busyDayNudges(9, '2026-09-30')[0].text).toContain('9×');
    expect(nudge.target).toEqual({ kind: 'chart', chart: 'daily', day: '2026-09-30' });
  });
});

describe('getting pricier', () => {
  const qa = (id: string, hoursAgo: number, workTokens: number) =>
    runEndingAt(id, hoursAgo, 10, { agent: 'qa', workTokens });
  const before = [
    qa('b1', LAST_WEEK, 100_000),
    qa('b2', LAST_WEEK, 100_000),
    qa('b3', LAST_WEEK, 100_000),
  ];

  it('nudges at 30% more a run this week, on three runs each side', () => {
    const week = [
      qa('w1', THIS_WEEK, 130_000),
      qa('w2', THIS_WEEK, 130_000),
      qa('w3', THIS_WEEK, 130_000),
    ];
    const [nudge] = pricierNudges([...before, ...week], AGENT_NOW);

    expect(nudge.text).toBe('qa is getting pricier: 130k a run this week, up from 100k');
    expect(nudge.target).toEqual({ kind: 'chart', chart: 'rank', agent: 'qa' });
  });

  it('leaves the pooled Other agents out', () => {
    const other = (id: string, hoursAgo: number, workTokens: number) =>
      runEndingAt(id, hoursAgo, 10, { agent: 'Explore', workTokens });
    const runs = [
      ...['b1', 'b2', 'b3'].map((id) => other(id, LAST_WEEK, 10_000)),
      ...['w1', 'w2', 'w3'].map((id) => other(id, THIS_WEEK, 90_000)),
    ];

    expect(pricierNudges(runs, AGENT_NOW)).toEqual([]);
  });

  it('stays quiet just under the ratio, or on too few runs', () => {
    const under = [
      qa('w1', THIS_WEEK, 129_000),
      qa('w2', THIS_WEEK, 129_000),
      qa('w3', THIS_WEEK, 129_000),
    ];
    const few = [qa('w1', THIS_WEEK, 500_000), qa('w2', THIS_WEEK, 500_000)];

    expect(pricierNudges([...before, ...under], AGENT_NOW)).toEqual([]);
    expect(pricierNudges([...before, ...few], AGENT_NOW)).toEqual([]);
  });
});

describe('rework', () => {
  const stage = (id: string, hoursAgo: number, agent: string) =>
    runEndingAt(id, hoursAgo, 5, { agent, issue: 618, repo: 'me/rivals', project: 'rivals' });

  it('nudges when a change runs a pipeline stage again this week, and leads to its issue', () => {
    const [nudge] = reworkNudges(
      [stage('d1', 30, 'dev'), stage('q1', 20, 'qa'), stage('d2', THIS_WEEK, 'dev')],
      AGENT_NOW,
    );

    expect(nudge.text).toBe('#618 in rivals ran its dev stage again');
    expect(nudge.target).toEqual({ kind: 'issue', repo: 'me/rivals', issue: 618 });
  });

  it('shows the most recent rework first', () => {
    const other = (id: string, hoursAgo: number, agent: string) =>
      runEndingAt(id, hoursAgo, 5, { agent, issue: 700, repo: 'me/rivals', project: 'rivals' });
    const nudges = reworkNudges(
      [stage('d1', 40, 'dev'), stage('d2', 30, 'dev'), other('q1', 20, 'qa'), other('q2', 5, 'qa')],
      AGENT_NOW,
    );

    expect(nudges.map((nudge) => nudge.id)).toEqual([
      'rework:me/rivals#700',
      'rework:me/rivals#618',
    ]);
  });

  it('stays quiet for rework before this week, and for ad-hoc agents run twice', () => {
    expect(
      reworkNudges([stage('d1', 100, 'dev'), stage('d2', LAST_WEEK, 'dev')], AGENT_NOW),
    ).toEqual([]);
    expect(
      reworkNudges([stage('e1', 30, 'Explore'), stage('e2', THIS_WEEK, 'Explore')], AGENT_NOW),
    ).toEqual([]);
  });
});

describe('skipped qa', () => {
  const run = (id: string, agent: string, project: string) =>
    runEndingAt(id, THIS_WEEK, 5, { agent, project });

  it('nudges a project where dev ran twice this week and qa never did', () => {
    const [nudge] = skippedQaNudges(
      [run('d1', 'dev', 'jobpilot'), run('d2', 'dev', 'jobpilot')],
      AGENT_NOW,
    );

    expect(nudge.text).toBe('jobpilot: dev ran 2 times this week, and qa never did');
    expect(nudge.target).toEqual({ kind: 'chart', chart: 'grid', project: 'jobpilot' });
  });

  it('stays quiet once qa has run, or after a single dev run', () => {
    const runs = [
      run('d1', 'dev', 'a'),
      run('d2', 'dev', 'a'),
      run('q1', 'qa', 'a'),
      run('d3', 'dev', 'b'),
    ];

    expect(skippedQaNudges(runs, AGENT_NOW)).toEqual([]);
  });
});

describe('agentNudges', () => {
  const runs = [
    ...['a', 'b', 'c'].map((id) => full(id, THIS_WEEK, 'dev')),
    ...['d', 'e', 'f'].map((id) => full(id, THIS_WEEK, 'qa')),
  ];

  it('shows the strongest of each kind, one a kind', () => {
    const nudges = agentNudges(runs, 2.5, AGENT_NOW, '2026-09-30', new Set());

    expect(nudges.map((nudge) => nudge.kind)).toEqual(['near-limit', 'busy-day']);
    expect(nudges[0].text).toContain('dev');
  });

  it('rests a dismissed kind for the day, so another of it cannot take its place', () => {
    const nudges = agentNudges(
      runs,
      2.5,
      AGENT_NOW,
      '2026-09-30',
      new Set(['near-limit' as const]),
    );

    // qa also came near the window, but dismissing the kind rests it too.
    expect(nudges.map((nudge) => nudge.kind)).toEqual(['busy-day']);
  });
});
