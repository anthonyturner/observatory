import {
  AGENT_NOW,
  agentRun,
  runEndingAt,
} from '../../../../core/agent-usage/testing/agent-run-fixture';
import { contextChart } from './agent-context';
import { dailyChart, windowDays } from './agent-daily';
import { NO_FILTER, runsMatching, runsTitle } from './agent-filter';
import { projectGrid } from './agent-grid';
import { agentOrrery } from './agent-orrery';
import { rankChart } from './agent-rank';
import { formatMinutes, groupName, groupTotals, niceCeiling } from './agent-stats';

const RUNS = [
  agentRun('d1', { agent: 'dev', workTokens: 300_000, peakContext: 150_000 }),
  agentRun('d2', {
    agent: 'dev',
    workTokens: 100_000,
    peakContext: 50_000,
    project: 'RivalsPulse',
  }),
  agentRun('p1', { agent: 'pm', workTokens: 50_000 }),
  agentRun('e1', { agent: 'Explore', workTokens: 20_000 }),
  agentRun('g1', { agent: 'general-purpose', workTokens: 10_000 }),
  agentRun('g2', { agent: 'general-purpose', workTokens: 10_000 }),
];

describe('groupTotals', () => {
  it('keeps the pipeline agents apart, in pipeline order, and folds the rest into Other', () => {
    const totals = groupTotals(RUNS);

    expect(totals.map((each) => each.group.id)).toEqual(['pm', 'dev', 'other']);
    expect(totals[1].workTokens).toBe(400_000);
    expect(totals[1].averagePeak).toBe(100_000);
    expect(totals[1].maxPeak).toBe(150_000);
    expect(totals[2].agents).toEqual(['general-purpose', 'Explore']);
  });

  it('names Other by what it holds', () => {
    expect(groupName(groupTotals(RUNS)[2])).toBe('other (general-purpose, Explore)');
  });
});

describe('formatting', () => {
  it('says a duration in the largest unit that reads well', () => {
    expect(formatMinutes(0.5)).toBe('30 s');
    expect(formatMinutes(54.4)).toBe('54 min');
    expect(formatMinutes(72)).toBe('1 h 12 min');
    expect(formatMinutes(120)).toBe('2 h');
  });

  it('rounds an axis end up to a round number', () => {
    expect(niceCeiling(186_000)).toBe(200_000);
    expect(niceCeiling(586_000)).toBe(1_000_000);
    expect(niceCeiling(0)).toBe(1);
  });
});

describe('A: rankChart', () => {
  it('ranks agents by work, longest bar for the most, with exact figures beside it', () => {
    const chart = rankChart(RUNS);

    expect(chart.rows.map((row) => row.id)).toEqual(['dev', 'pm', 'other']);
    expect(chart.rows[0].value).toBe('400k');
    expect(chart.rows[0].detail).toBe('2 runs · 200k/run');
    expect(chart.rows[0].barWidth).toBeGreaterThan(chart.rows[1].barWidth);
    expect(chart.table[2].label).toBe('other (general-purpose, Explore)');
  });
});

describe('B: contextChart', () => {
  it('draws a dot a run, in its agent group, with a median tick per agent', () => {
    const chart = contextChart(RUNS);

    expect(chart.dots).toHaveLength(RUNS.length);
    expect(chart.dots.filter((dot) => dot.group === 'other')).toHaveLength(3);
    expect(chart.rows.map((row) => row.id)).toEqual(['pm', 'dev', 'other']);
  });

  it('marks the 200k window only when a run went past it', () => {
    expect(contextChart(RUNS).window).toBeNull();

    const past = contextChart([...RUNS, agentRun('big', { peakContext: 586_000 })]);
    expect(past.window).not.toBeNull();
    expect(past.band?.width).toBeGreaterThan(0);
    expect(past.axis.at(-1)?.text).toBe('1.0M');
  });
});

describe('C: dailyChart', () => {
  const days = windowDays(AGENT_NOW, 30);

  it('covers the month, ending today', () => {
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toBe('2026-09-30');
  });

  it('stacks a day by agent with a gap between colours, rounded only at the top', () => {
    const chart = dailyChart(RUNS, days, null);
    const today = chart.segments.slice(-3);

    expect(today.map((segment) => segment.colour)).toEqual([
      'var(--agent-pm)',
      'var(--agent-dev)',
      'var(--agent-other)',
    ]);
    expect(today.map((segment) => segment.isTop)).toEqual([false, false, true]);
    expect(today[1].y + today[1].height).toBeLessThanOrEqual(today[0].y - 2 + 0.1);
  });

  it('gives every day a hit that names its work, and outlines the picked day', () => {
    const chart = dailyChart([runEndingAt('old', 48, 10)], days, '2026-09-28');

    expect(chart.hits).toHaveLength(30);
    expect(chart.hits.at(-1)?.tip).toContain('no agent runs');
    expect(chart.hits.at(-3)?.tip).toContain('100k work tokens');
    expect(chart.picked).not.toBeNull();
  });
});

describe('E: projectGrid', () => {
  it('lays agents against projects, busiest project first, brighter for more work', () => {
    const grid = projectGrid(RUNS, { project: 'RivalsPulse', agent: 'dev' });

    expect(grid.columns.map((column) => column.text)).toEqual(['observatory', 'RivalsPulse']);
    const dev = grid.cells.filter((cell) => cell.agent === 'dev');
    expect(dev[0].fill).toBe('var(--agent-heat-8)');
    expect(dev[1].isPicked).toBe(true);
    const empty = grid.cells.find((cell) => cell.agent === 'pm' && cell.project === 'RivalsPulse');
    expect(empty?.fill).toBe('var(--agent-heat-empty)');
    expect(empty?.tip).toContain('Never ran here');
  });
});

describe('F: agentOrrery', () => {
  it('gives each agent a moon on its own orbit, the busiest largest, arc by peak context', () => {
    const { moons } = agentOrrery(RUNS);

    expect(moons.map((moon) => moon.id)).toEqual(['pm', 'dev', 'other']);
    expect(moons[1].radius).toBeGreaterThan(moons[0].radius);
    expect(new Set(moons.map((moon) => moon.orbitX)).size).toBe(3);
    expect(moons[1].arcDash.split(' ').map(Number)[0]).toBeLessThan(
      moons[1].arcDash.split(' ').map(Number)[1],
    );
  });
});

describe('runsMatching', () => {
  it('narrows by project, agent group and day together', () => {
    expect(runsMatching(RUNS, NO_FILTER)).toHaveLength(RUNS.length);
    expect(runsMatching(RUNS, { ...NO_FILTER, agent: 'other' })).toHaveLength(3);
    expect(runsMatching(RUNS, { ...NO_FILTER, agent: 'dev', project: 'RivalsPulse' })).toHaveLength(
      1,
    );
    expect(runsMatching(RUNS, { ...NO_FILTER, day: '2026-09-29' })).toHaveLength(0);
  });

  it('titles the run list by what it shows', () => {
    const label = (day: string) => `day ${day}`;
    expect(runsTitle(NO_FILTER, label)).toBe('Latest runs');
    expect(runsTitle({ project: 'RivalsPulse', agent: 'dev', day: 'x' }, label)).toBe(
      'dev runs in RivalsPulse on day x',
    );
  });
});
