import { InsightsReport } from '../../core/insights/insights-report';
import { NO_HANDOFF } from '../../core/queue/weekly-retro';
import {
  agentsSection,
  commitsSection,
  contributorsSection,
  cycleSection,
  trafficSection,
} from './insights-view';
import { NO_AGENTS, NO_COMMITS, NO_MERGES } from './insights-words';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const HOUR_MS = 3_600_000;
const READ = { status: 'read' as const, note: null };
const SERIES = { count: 3, uniques: 2, days: [{ day: NOW - 24 * HOUR_MS, count: 3, uniques: 2 }] };

function report(more: Partial<InsightsReport> = {}): InsightsReport {
  return {
    generatedAt: NOW,
    repo: 'me/app',
    weeks: 12,
    commits: {
      ...READ,
      weeks: [{ start: NOW - 72 * HOUR_MS, total: 5, days: [5, 0, 0, 0, 0, 0, 0] }],
    },
    contributors: {
      ...READ,
      people: [{ login: 'me', isBot: false, commits: 5, additions: 50, deletions: 1 }],
    },
    pulls: {
      ...READ,
      finished: [
        { number: 4, openedAt: NOW - 10 * HOUR_MS, finishedAt: NOW - 4 * HOUR_MS, fate: 'merged' },
        { number: 5, openedAt: NOW - 9 * HOUR_MS, finishedAt: NOW - 3 * HOUR_MS, fate: 'merged' },
      ],
    },
    traffic: { ...READ, views: SERIES, clones: SERIES },
    ...more,
  };
}

describe('insights sections', () => {
  it('draws each part GitHub gave, with its table', () => {
    const whole = report();

    for (const section of [
      commitsSection(whole, 600),
      cycleSection(whole, 600),
      contributorsSection(whole, 600),
      trafficSection(whole, 600),
    ]) {
      expect(section.note).toBeNull();
      expect(section.chart).not.toBeNull();
      expect(section.table?.rows.length).toBeGreaterThan(0);
    }
    expect(cycleSection(whole, 600).chart?.bars).toHaveLength(12);
  });

  it('shows the part’s own note in place of a chart when GitHub did not give it', () => {
    const counting = { status: 'counting' as const, note: 'GitHub is still counting.' };
    const section = contributorsSection(report({ contributors: { ...counting, people: [] } }), 600);

    expect(section).toEqual({ note: 'GitHub is still counting.', chart: null, table: null });
  });

  it('says so when the weeks hold no commits or merges', () => {
    const quiet = report({
      commits: { ...READ, weeks: [{ start: NOW, total: 0, days: [0, 0, 0, 0, 0, 0, 0] }] },
      pulls: { ...READ, finished: [] },
    });

    expect(commitsSection(quiet, 600).note).toBe(NO_COMMITS);
    expect(cycleSection(quiet, 600).note).toBe(NO_MERGES);
  });

  it('names agents only where the report cards claim a pull request', () => {
    const whole = report();
    const cards = (prs: number[]) => ({
      since: null,
      attributed: prs.length,
      agents: [
        {
          agent: 'builder',
          basis: 'handoff',
          prs,
          opened: 0,
          merged: 0,
          open: 0,
          conflicting: 0,
          unlinked: 0,
          medianMergeHours: null,
          medianLines: null,
        },
      ],
    });

    expect(agentsSection(whole, null, 600).note).toBe(NO_AGENTS);
    expect(agentsSection(whole, cards([99]), 600).note).toBe(NO_AGENTS);
    const section = agentsSection(whole, cards([4]), 600);
    expect(section.table?.rows.map((row) => row.cells[0])).toEqual(['builder', NO_HANDOFF]);
  });
});
