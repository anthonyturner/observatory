import { IssuesReport } from '../../core/issues/issues-report';
import { cometsOf } from './comets';
import { layoutComets } from './engine/comet-layer';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const DAY = 86_400_000;
const issue = (number: number, comet: boolean, idleDays: number) => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/me/a/issues/${number}`,
  labels: [{ name: 'bug', color: 'd73a4a' }],
  assignees: [],
  author: null,
  createdAt: new Date(NOW - (idleDays + 10) * DAY).toISOString(),
  updatedAt: new Date(NOW - idleDays * DAY).toISOString(),
  closedAt: null,
  stateReason: null,
  comet,
  prs: comet ? [] : [9],
});

describe('cometsOf', () => {
  it('keeps the issues no pull request closes, idlest first, aged from their dates', () => {
    const report: IssuesReport = {
      generatedAt: 'x',
      repo: 'me/a',
      days: 60,
      total: { open: 4, closed: 0, comets: 3 },
      open: [issue(1, true, 5), issue(2, false, 50), issue(3, true, 40), issue(4, true, 40)],
      closed: [],
    };

    const comets = cometsOf(report, NOW);

    expect(comets.map((c) => c.issue)).toEqual([3, 4, 1]);
    expect(comets[0]).toEqual({
      issue: 3,
      title: 'Issue 3',
      url: 'https://github.com/me/a/issues/3',
      labels: ['bug'],
      ageDays: 50,
      idleDays: 40,
    });
    expect(cometsOf(null, NOW)).toEqual([]);
  });
});

describe('layoutComets', () => {
  it('puts each comet on the orbit pr-starmap gives it', () => {
    const laid = layoutComets(
      [
        { issue: 12, ageDays: 40, idleDays: 30 },
        { issue: 7, ageDays: 2, idleDays: 100 },
      ],
      40,
    );

    // pr-starmap's own layoutComets, run on the same issues (assets/dashboard.html).
    expect(
      laid.map((k) => ({
        issue: k.comet.issue,
        rx: +k.rx.toFixed(3),
        ry: +k.ry.toFixed(3),
        phase: +k.phase.toFixed(4),
        speed: +k.speed.toFixed(5),
        mag: +k.mag.toFixed(3),
        tail: +k.tail.toFixed(2),
      })),
    ).toEqual([
      {
        issue: 12,
        rx: 782.304,
        ry: 586.611,
        phase: 4.2541,
        speed: -0.01723,
        mag: 5.246,
        tail: 106,
      },
      { issue: 7, rx: 1277.659, ry: 848.559, phase: 4.6389, speed: 0.01774, mag: 3.036, tail: 230 },
    ]);
  });

  it('draws at most the cap', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ issue: i + 1, ageDays: 1, idleDays: 1 }));
    expect(layoutComets(many, 40).length).toBe(40);
  });
});
