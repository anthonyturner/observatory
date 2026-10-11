import { EMBER_SPAN_S } from './closed-ember';
import { PRELUDE_S } from './departure-exit';
import { exitBeat, exitBeats, exitCues, exitStartsOf, hasExit } from './exits';
import { MERGE_SPAN_S } from './merge-supernova';
import { SQUASH_SPAN_S } from './squash-collapse';
import { Point } from '../sound/doppler';
import { issuePlanets } from '../engine/star-system';
import { EMPTY_SYSTEM, endingOf } from './departure';

const scene = (extra: object = {}) => ({
  now: 10,
  width: 1000,
  height: 800,
  frozen: false,
  project: (x: number, y: number, z: number): Point => ({ x, y, z }),
  ...extra,
});

const news = (kind: string, startAt?: number) => ({
  kind,
  startAt,
  fromX: 500,
  fromY: 100,
  fromZ: 0,
  angle: 0,
});

describe('which news is an exit', () => {
  it('gives a merge, a squash and a close an exit each, and nothing else one', () => {
    expect(['merged', 'squashed', 'closed'].every(hasExit)).toBe(true);
    expect(['blocked', 'opened', 'unblocked', 'left', 'toString'].some(hasExit)).toBe(false);
  });
});

describe('the beats of an exit', () => {
  it('begin after the prelude, turn when the first act hands over, and end with the span', () => {
    for (const [kind, span] of [
      ['merged', MERGE_SPAN_S],
      ['squashed', SQUASH_SPAN_S],
      ['closed', EMBER_SPAN_S],
    ] as const) {
      const beats = exitBeats(kind);

      expect(beats?.beginS).toBe(PRELUDE_S);
      expect(beats?.turnS).toBeGreaterThan(beats?.beginS ?? 0);
      expect(beats?.endS).toBeGreaterThan(beats?.turnS ?? 0);
      expect(beats?.endS).toBeCloseTo(span);
    }
    expect(exitBeats('left')).toBeNull();
  });

  it('fall on the wall clock from when the exit was started', () => {
    const ev = news('squashed', 20);

    expect(exitBeat(ev, 'begin')).toBe(20 + PRELUDE_S);
    expect(exitBeat(ev, 'turn')).toBeCloseTo(20 + (exitBeats('squashed')?.turnS ?? 0));
    expect(exitBeat(ev, 'end')).toBeCloseTo(20 + SQUASH_SPAN_S);
  });

  it('are unknown for news that is no exit, or that has not been started', () => {
    expect(exitBeat(news('left', 20), 'begin')).toBeNull();
    expect(exitBeat(news('merged'), 'end')).toBeNull();
  });
});

describe('exitCues', () => {
  it('gives each way out its own sound', () => {
    const cues = exitCues([news('merged', 11), news('squashed', 11), news('closed', 11)], scene());

    expect(cues.map((each) => each.exit)).toEqual(['merge', 'implosion', 'sink']);
  });

  it('is silent for news with no exit, or one that has not started', () => {
    const quiet = [news('blocked', 10), news('left', 10), news('opened', 10), news('merged')];

    expect(exitCues(quiet, scene())).toEqual([]);
    expect(exitCues([], scene())).toEqual([]);
  });

  it('plays no more than four in one refresh, whichever way they left', () => {
    const many = ['merged', 'squashed', 'closed'].flatMap((kind) =>
      [10, 11].map((at) => news(kind, at)),
    );

    expect(exitCues(many, scene())).toHaveLength(4);
  });

  it('carries the chimes and suction of the company, counted with the exit that holds them', () => {
    const company = {
      ...news('merged', 11),
      departure: {
        system: { ...EMPTY_SYSTEM, planets: issuePlanets({ item: { issues: [3] } as never }) },
        ending: endingOf('merged'),
      },
    };
    const [loud, quiet] = exitCues([company, news('closed', 11)], scene());

    expect(loud.company.chimes).toHaveLength(1);
    expect(quiet.company).toEqual({ chimes: [], suction: null });
    expect(
      exitCues(
        Array.from({ length: 6 }, () => company),
        scene(),
      ),
    ).toHaveLength(4);
  });

  it('keeps only each exit’s first act in the sound when motion is off', () => {
    const [merge, implosion, sink] = exitCues(
      [news('merged', 10), news('squashed', 10), news('closed', 10)],
      scene({ frozen: true }),
    );

    expect(merge.exit === 'merge' && merge.cue.whoosh).toEqual([]);
    expect(implosion.exit === 'implosion' && implosion.cue).toMatchObject({
      sweeps: false,
      whoosh: [],
    });
    expect(sink.exit === 'sink' && sink.cue.sink).toEqual([]);
  });
});

describe('exitStartsOf', () => {
  it('gives each started exit once, with the instant its star begins to go', () => {
    const starts = exitStartsOf([
      { ...news('merged', 20), pr: 1 },
      { ...news('squashed', 30), pr: 2 },
      { ...news('closed', 40), pr: 3 },
    ]);

    expect(starts).toEqual([
      { pr: 1, kind: 'merged', startAt: 20 + PRELUDE_S },
      { pr: 2, kind: 'squashed', startAt: 30 + PRELUDE_S },
      { pr: 3, kind: 'closed', startAt: 40 + PRELUDE_S },
    ]);
  });

  it('leaves out news that is no exit, and exits not yet started', () => {
    expect(
      exitStartsOf([
        { ...news('left', 20), pr: 1 },
        { ...news('blocked', 20), pr: 2 },
        { ...news('merged'), pr: 3 },
      ]),
    ).toEqual([]);
  });
});
