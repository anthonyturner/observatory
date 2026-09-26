import { aReport, anIssue } from '../../core/issues/testing/issues-fixture';
import {
  IssueTab,
  issueMatches,
  issueRowView,
  issueSection,
  labelInk,
  labelOptions,
  pullChips,
} from './issue-list';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const ALL = { label: '', query: '', cometsOnly: false };
const bug = { name: 'bug', color: 'd73a4a' };
const docs = { name: 'docs', color: '0075ca' };

describe('issueMatches', () => {
  const issue = anIssue(42, { title: 'Fix the Lobby', labels: [bug], comet: false });

  it('matches a title as typed, or #n for one issue', () => {
    expect(issueMatches(issue, { ...ALL, query: 'lobby' })).toBe(true);
    expect(issueMatches(issue, { ...ALL, query: '#42' })).toBe(true);
    expect(issueMatches(issue, { ...ALL, query: '42' })).toBe(true);
    expect(issueMatches(issue, { ...ALL, query: '#4' })).toBe(false);
  });

  it('narrows to a label, and to comets', () => {
    expect(issueMatches(issue, { ...ALL, label: 'bug' })).toBe(true);
    expect(issueMatches(issue, { ...ALL, label: 'docs' })).toBe(false);
    expect(issueMatches(issue, { ...ALL, cometsOnly: true })).toBe(false);
  });
});

describe('labelOptions', () => {
  it('lists the labels the list carries, by name, with a chosen one kept', () => {
    const list = [anIssue(1, { labels: [docs, bug] }), anIssue(2, { labels: [bug] })];

    expect(labelOptions(list, 'gone')).toEqual([
      { name: 'bug', count: 2 },
      { name: 'docs', count: 1 },
      { name: 'gone', count: 0 },
    ]);
  });
});

describe('labelInk', () => {
  it("paints GitHub's six hex digits and nothing else", () => {
    expect(labelInk('d73a4a')).toBe('#d73a4a');
    expect(labelInk('red')).toBe('var(--faint)');
  });
});

describe('pullChips', () => {
  it('opens an open pull request here and any other on GitHub', () => {
    const open = new Map([[5, { title: 'Fix', colour: '#ff6f5e' }]]);

    const chips = pullChips([5, 6], 'https://github.com/me/a/issues/1', open);

    expect(chips[0]).toEqual({
      number: 5,
      title: 'Open pull request #5: Fix',
      colour: '#ff6f5e',
      href: null,
    });
    expect(chips[1].href).toBe('https://github.com/me/a/pull/6');
    expect(chips[1].title).toBe('Pull request #6 is merged or closed; opens on GitHub');
  });
});

describe('issueRowView', () => {
  it('says how long an open issue has been open, edged as a comet', () => {
    const row = issueRowView(anIssue(1, { createdAt: '2026-09-14T11:00:00Z' }), new Map(), NOW);

    expect(row.when).toBe('open 12d');
    expect(row.sev).toBe('var(--count-unclaimed)');
  });

  it('says when a closed issue closed, and marks one not planned', () => {
    const closed = anIssue(2, {
      comet: false,
      closedAt: '2026-09-20T12:00:00Z',
      stateReason: 'NOT_PLANNED',
    });

    const row = issueRowView(closed, new Map(), NOW);

    expect(row.when).toMatch(/^closed .+ · not planned$/);
    expect(row.sev).toBe('var(--faint)');
  });
});

describe('issueSection', () => {
  const report = aReport([anIssue(1, { labels: [bug] }), anIssue(2, { comet: false }), anIssue(3)]);
  const section = (tab: IssueTab, narrowing = ALL) =>
    issueSection({ tab, report, narrowing, pulls: new Map(), now: NOW });

  it('heads the open list with its count and how many nobody is on', () => {
    const open = section('open');

    expect(open.heading).toBe('Open issues');
    expect(open.counts).toBe('3 · 2 with nobody on them');
    expect(open.rows.length).toBe(3);
  });

  it('counts what matches of the whole when narrowed', () => {
    expect(section('open', { ...ALL, label: 'bug' }).counts).toBe('1 of 3 · 1 with nobody on it');
    expect(section('open', { ...ALL, query: 'zzz' }).none).toBe('Nothing matches.');
  });

  it('says an empty tab is empty', () => {
    expect(section('closed').none).toBe('Nothing closed in the last 60 days.');
    expect(section('closed').heading).toBe('Closed in the last 60 days');
  });
});
