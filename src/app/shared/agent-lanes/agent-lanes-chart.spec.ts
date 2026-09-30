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

  it('finds a review that names only the pull request, run from main', () => {
    const review = runEndingAt('review', 0.5, 8, { agent: 'qa', branch: 'main', pull: 40 });

    expect(
      runsFor([...RUNS, review], { repo: 'me/observatory', issue: 12, pull: 40 }).map(
        (run) => run.id,
      ),
    ).toEqual(['pm', 'dev1', 'qa', 'dev2', 'review']);
    expect(runsFor([review], { repo: 'me/observatory', issue: null, pull: 40 })).toHaveLength(1);
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

  it('keeps every label whole: its full text fits after, before or inside its bar', () => {
    const width = (text: string) => text.length * 6.4;
    for (const lane of chart?.lanes ?? []) {
      const { x, text, anchor } = lane.label;
      if (lane.labelInside) expect(x + width(text)).toBeLessThanOrEqual(lane.x + lane.width);
      else if (anchor === 'start') expect(x + width(text)).toBeLessThanOrEqual(chart?.width ?? 0);
      else expect(x - width(text)).toBeGreaterThanOrEqual(chart?.labelX ?? 0);
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
