import { Issue } from '../../../core/issues/issues-report';
import { anIssue } from '../../../core/issues/testing/issues-fixture';
import { SkyLayout } from '../engine/sky-layout';
import { NurseryLayer } from './nursery-layer';
import { NurseryInput, bodyOf, layoutIssues, skyInk } from './nursery-layout';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const lab = (name: string, color: string) => ({ name, color });
const iss = (number: number, fields: Partial<Issue> = {}): Issue =>
  anIssue(number, { createdAt: '2026-08-01T12:00:00Z', ...fields });
const closed = (
  number: number,
  closedAt: string,
  stateReason: string | null,
  labels = [lab('bug', 'd73a4a')],
) => iss(number, { comet: false, closedAt, stateReason, labels });

/* The issues pr-starmap's own layoutIssues was run on (assets/dashboard.html,
   sliced out and run in Node at NOW), and what it placed. */
const OPEN_ISSUES = [
  iss(12, { labels: [lab('bug', 'd73a4a')], updatedAt: '2026-09-25T12:00:00Z' }),
  iss(15, {
    labels: [lab('bug', 'd73a4a'), lab('ui', '000000')],
    comet: false,
    prs: [40, 41],
    assignees: ['ann'],
  }),
  iss(18, {
    labels: [lab('docs', '0075ca')],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  }),
  iss(21, { updatedAt: '2026-09-26T11:00:00Z' }),
  iss(33, { labels: [lab('ui', '000000')], comet: false, prs: [44, 50] }),
  iss(34, { labels: [lab('a1', 'aaaaaa')] }),
  iss(35, { labels: [lab('a2', 'bbbbbb')] }),
  iss(36, { labels: [lab('a3', 'cccccc')] }),
  iss(37, { labels: [lab('a4', 'dddddd')] }),
  iss(38, { labels: [lab('a4', 'dddddd')] }),
];
const CLOSED_ISSUES = [
  closed(50, '2026-09-20T00:00:00Z', 'COMPLETED'),
  closed(51, '2026-08-10T00:00:00Z', 'NOT_PLANNED'),
  closed(52, '2026-09-01T00:00:00Z', null, []),
];
const OPEN = [
  {
    n: 12,
    look: 'globule',
    arm: 'bug',
    x: 1832.742,
    y: 1130.13,
    rad: 226.738,
    theta: 1.4259,
    mag: 9.735,
    jet: 0.7928,
    jets: [],
    drift: 5.248,
    spin: 0.4465,
    delay: 0.1,
    fade: 1,
    colour: '#dc5563',
  },
  {
    n: 15,
    look: 'protostar',
    arm: 'bug',
    x: 1503.997,
    y: 1168.54,
    rad: 414.799,
    theta: 2.3654,
    mag: 8.49,
    jet: 1.0613,
    jets: [40],
    drift: 5.517,
    spin: 1.1663,
    delay: 0.135,
    fade: 1,
    colour: '#dc5563',
  },
  {
    n: 18,
    look: 'globule',
    arm: 'docs',
    x: 2456.657,
    y: 1357.469,
    rad: 900.586,
    theta: 7.0369,
    mag: 15,
    jet: 0.2091,
    jets: [],
    drift: 5.896,
    spin: 0.8965,
    delay: 0.17,
    fade: 1,
    colour: '#1a83cf',
  },
  {
    n: 21,
    look: 'globule',
    arm: '',
    x: 1635.098,
    y: 1015.948,
    rad: 167.178,
    theta: 2.9764,
    mag: 9.735,
    jet: 1.7243,
    jets: [],
    drift: 4.278,
    spin: 2.4506,
    delay: 0.205,
    fade: 1,
    colour: '#8d9bc4',
  },
  {
    n: 33,
    look: 'protostar',
    arm: 'other labels',
    x: 2167.257,
    y: 1133.526,
    rad: 433.449,
    theta: 6.8431,
    mag: 8.49,
    jet: 1.6949,
    jets: [44],
    drift: 3.994,
    spin: 2.994,
    delay: 0.24,
    fade: 1,
    colour: '#8d9bc4',
  },
  {
    n: 34,
    look: 'globule',
    arm: 'a1',
    x: 1401.844,
    y: 976.981,
    rad: 400.129,
    theta: 3.2409,
    mag: 9.735,
    jet: 0.0514,
    jets: [],
    drift: 4.955,
    spin: 0.5253,
    delay: 0.275,
    fade: 1,
    colour: '#aaaaaa',
  },
  {
    n: 35,
    look: 'globule',
    arm: 'a2',
    x: 1515.048,
    y: 812.679,
    rad: 430.703,
    theta: 3.9894,
    mag: 9.735,
    jet: 1.9243,
    jets: [],
    drift: 5.04,
    spin: 0.3244,
    delay: 0.31,
    fade: 1,
    colour: '#bbbbbb',
  },
  {
    n: 36,
    look: 'globule',
    arm: 'a3',
    x: 1917.298,
    y: 775.379,
    rad: 404.651,
    theta: 5.0065,
    mag: 9.735,
    jet: 2.5222,
    jets: [],
    drift: 3.199,
    spin: 1.341,
    delay: 0.345,
    fade: 1,
    colour: '#cccccc',
  },
  {
    n: 37,
    look: 'globule',
    arm: 'a4',
    x: 1836.392,
    y: 1238.82,
    rad: 413.363,
    theta: 1.4826,
    mag: 9.735,
    jet: 0.9175,
    jets: [],
    drift: 5.618,
    spin: 0.2233,
    delay: 0.38,
    fade: 1,
    colour: '#dddddd',
  },
  {
    n: 38,
    look: 'globule',
    arm: 'a4',
    x: 1840.955,
    y: 1242.522,
    rad: 420.143,
    theta: 1.4732,
    mag: 9.735,
    jet: 0.6546,
    jets: [],
    drift: 3.77,
    spin: 0.3207,
    delay: 0.415,
    fade: 1,
    colour: '#dddddd',
  },
];
const CLOSED = [
  {
    n: 50,
    look: 'settled',
    arm: 'bug',
    x: 1600.943,
    y: 1354.653,
    rad: 643.056,
    theta: 1.8855,
    mag: 5.119,
    jet: 2.3753,
    jets: [],
    drift: 5.212,
    spin: 1.243,
    delay: 0.1,
    fade: 0.935,
    colour: '#dc5563',
  },
  {
    n: 51,
    look: 'dust',
    arm: 'bug',
    x: 1986.653,
    y: 1048.176,
    rad: 204.3,
    theta: 0.4187,
    mag: 5.119,
    jet: 2.1087,
    jets: [],
    drift: 5.822,
    spin: 1.0142,
    delay: 0.135,
    fade: 0.4908,
    colour: '#dc5563',
  },
  {
    n: 52,
    look: 'dust',
    arm: '',
    x: 2123.292,
    y: 842.051,
    rad: 422.705,
    theta: 5.5831,
    mag: 5.119,
    jet: 1.3825,
    jets: [],
    drift: 4.795,
    spin: 0.754,
    delay: 0.17,
    fade: 0.7292,
    colour: '#8d9bc4',
  },
];
const OPEN_ARMS = [
  { label: 'a4', sub: '2 ISSUES', colour: '#dddddd', halo: false },
  { label: 'bug', sub: '2 ISSUES', colour: '#dc5563', halo: false },
  { label: 'a1', sub: '1 ISSUE', colour: '#aaaaaa', halo: false },
  { label: 'a2', sub: '1 ISSUE', colour: '#bbbbbb', halo: false },
  { label: 'a3', sub: '1 ISSUE', colour: '#cccccc', halo: false },
  { label: 'docs', sub: '1 ISSUE', colour: '#1a83cf', halo: false },
  { label: 'other labels', sub: '1 ISSUE', colour: '#8d9bc4', halo: false },
  { label: '', sub: '', colour: '#8d9bc4', halo: true },
];
const CLOSED_ARMS = [
  { label: 'bug', sub: '2 ISSUES', colour: '#dc5563', halo: false },
  { label: '', sub: '', colour: '#8d9bc4', halo: true },
];
const SPUN = [
  [899.486, 794.04],
  [1516.17, 463.237],
  [2346.584, 536.628],
  [2765.409, 958.947],
  [2457.261, 1412.18],
  [1654.182, 1555.033],
  [960.907, 1279.935],
];
const INKS = ['#dc5563', '#b3b3b3', '#8d9bc4', '#1a83cf'];

const input = (list: readonly Issue[], closedTab: boolean): NurseryInput => ({
  list,
  closedTab,
  days: 60,
  openPulls: new Set([40, 44]),
  now: NOW,
});

function laid(list: readonly Issue[], closedTab: boolean) {
  const sky = new SkyLayout();
  const nursery = layoutIssues(input(list, closedTab), sky);
  const stars = sky.stars.map((s) => {
    const body = bodyOf(s);
    return {
      n: body?.issue.number,
      look: body?.look,
      arm: s.cluster.label,
      x: +s.x.toFixed(3),
      y: +s.y.toFixed(3),
      rad: +(body?.rad ?? 0).toFixed(3),
      theta: +(body?.theta0 ?? 0).toFixed(4),
      mag: +s.mag.toFixed(3),
      jet: +(body?.jetAngle ?? 0).toFixed(4),
      jets: body?.jets,
      drift: +s.driftRadius.toFixed(3),
      spin: +s.spin.toFixed(4),
      delay: +s.delay.toFixed(3),
      fade: +(body?.fade ?? 0).toFixed(4),
      colour: s.colour,
    };
  });
  const arms = sky.clusters.map((c) => ({
    label: c.label,
    sub: c.sub,
    colour: c.colour,
    halo: !!c.halo,
  }));
  return { sky, nursery, stars, arms };
}

describe('layoutIssues', () => {
  it('places every open issue exactly where pr-starmap does', () => {
    const { stars, arms, sky } = laid(OPEN_ISSUES, false);

    expect(stars).toEqual(OPEN);
    expect(arms).toEqual(OPEN_ARMS);
    expect(sky.stars.every((s) => s.z === 0 && s.custom)).toBe(true);
  });

  it('settles finished work and leaves the rest as dust on the Closed tab', () => {
    const { stars, arms } = laid(CLOSED_ISSUES, true);

    expect(stars).toEqual(CLOSED);
    expect(arms).toEqual(CLOSED_ARMS);
  });

  it('lays nothing out for an empty tab', () => {
    const sky = new SkyLayout();

    expect(layoutIssues(input([], false), sky)).toBeNull();
    expect(sky.stars.length).toBe(0);
  });
});

describe('skyInk', () => {
  it('lifts dark label colours toward white, as pr-starmap does', () => {
    expect(['d73a4a', '000000', 'zz', '0075ca'].map(skyInk)).toEqual(INKS);
  });
});

describe('NurseryLayer', () => {
  it('turns the arms’ labels round the disk as pr-starmap spins them', () => {
    const { nursery } = laid(OPEN_ISSUES, false);
    const layer = new NurseryLayer(document);
    layer.setNursery(nursery);

    layer.move(100, false);

    expect(
      nursery?.arms.map(({ cluster }) => [+cluster.cx.toFixed(3), +cluster.labelY.toFixed(3)]),
    ).toEqual(SPUN);
  });

  it('holds the disk still when motion is off', () => {
    const { nursery, sky } = laid(OPEN_ISSUES, false);
    const layer = new NurseryLayer(document);
    layer.setNursery(nursery);
    const before = sky.stars.map((s) => [s.x, s.y]);

    layer.move(100, true);

    expect(sky.stars.map((s) => [+s.x.toFixed(6), +s.y.toFixed(6)])).toEqual(
      before.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]),
    );
  });
});
