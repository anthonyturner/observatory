import { runEndingAt } from '../../core/agent-usage/testing/agent-run-fixture';
import { issueFromBranch, lanesChart, runsFor } from './agent-lanes-chart';

const RUNS = [
  runEndingAt('pm', 5, 4, { agent: 'pm', description: 'File issue 12', issue: 12 }),
  runEndingAt('dev1', 3, 60, { agent: 'dev', branch: 'feat/12-thing', issue: 12 }),
  runEndingAt('qa', 2, 10, { agent: 'qa', branch: 'feat/12-thing', issue: 12 }),
  runEndingAt('dev2', 1, 20, { agent: 'dev', branch: 'feat/12-thing', issue: 12 }),
  runEndingAt('other', 1, 5, { agent: 'dev', issue: 13 }),
  runEndingAt('elsewhere', 1, 5, { agent: 'dev', issue: 12, repo: 'me/other' }),
];

describe('runsFor', () => {
  it('finds an issue’s runs in this repository only, oldest first', () => {
    expect(runsFor(RUNS, { repo: 'ME/observatory', issue: 12 }).map((run) => run.id)).toEqual([
      'pm',
      'dev1',
      'qa',
      'dev2',
    ]);
  });

  it('finds none without an issue, rather than every run with none', () => {
    expect(runsFor(RUNS, { repo: 'me/observatory', issue: null })).toEqual([]);
  });

  it('reads the issue a branch is named for', () => {
    expect(issueFromBranch('feat/217-agent-usage')).toBe(217);
    expect(issueFromBranch('main')).toBeNull();
    expect(issueFromBranch(null)).toBeNull();
  });
});

describe('lanesChart', () => {
  const chart = lanesChart(runsFor(RUNS, { repo: 'me/observatory', issue: 12 }));

  it('draws nothing for a change no agent worked on', () => {
    expect(lanesChart([])).toBeNull();
  });

  it('gives each run its own lane in time order, joined by hand-offs', () => {
    expect(chart?.lanes.map((lane) => lane.agent)).toEqual(['pm', 'dev', 'qa', 'dev']);
    expect(chart?.handoffs).toHaveLength(3);
    const [pm, dev] = chart?.lanes ?? [];
    expect(dev.x).toBeGreaterThan(pm.x + pm.width);
  });

  it('marks a stage that ran again as rework', () => {
    expect(chart?.lanes.map((lane) => lane.isRepeat)).toEqual([false, false, false, true]);
    expect(chart?.lanes[3].label.text.startsWith('↻')).toBe(true);
    expect(chart?.lanes[3].tip).toContain('ran again');
  });

  it('keeps each label inside the chart, before the bar when there is no room after it', () => {
    for (const lane of chart?.lanes ?? []) {
      if (lane.label.anchor === 'start')
        expect(lane.label.x).toBeLessThan((chart?.width ?? 0) - 150);
      else expect(lane.label.x).toBeLessThanOrEqual(lane.x);
    }
    expect(chart?.span).toBe('4.1 h');
  });

  it('puts a label inside a bar that fills the chart, never over the agent names', () => {
    const long = lanesChart([runEndingAt('one', 0.2, 90), runEndingAt('two', 0.1, 3)]);
    const [wide] = long?.lanes ?? [];

    expect(wide.labelInside).toBe(true);
    expect(wide.label.x).toBeGreaterThan(wide.x);
    expect(wide.label.x).toBeGreaterThan(long?.labelX ?? 0);
  });
});
