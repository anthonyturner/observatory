import { CrewMark } from '../../../core/crew/crew.types';
import { Satellite } from '../../../core/live-agents/satellites';
import { EMPTY_SYSTEM, StarSystem } from './departure';
import { PRELUDE_S } from './departure-exit';
import { exitBeat } from './exits';
import { NewsEvent } from './news';
import {
  FLIGHT_S,
  Undock,
  departedRadius,
  flightOf,
  flightPoint,
  stillAway,
  undockCues,
  undocksOf,
} from './undock';

const satellite = (key: string): Satellite => ({
  key,
  name: `agent ${key}`,
  state: 'working',
  pr: 7,
  stateText: 'Working',
});
const crew = (phase: CrewMark['phase']): CrewMark => ({
  pr: 7,
  phase,
  endedAt: phase === 'working' ? null : 1,
});

const leaving = (system: Partial<StarSystem>, fields: Partial<NewsEvent> = {}): NewsEvent => ({
  kind: 'merged',
  pr: 7,
  title: 'Seven',
  bucket: 'fresh',
  departure: { system: { ...EMPTY_SYSTEM, ...system }, ending: null },
  startAt: 100,
  fromX: 10,
  fromY: 20,
  fromZ: 30,
  ...fields,
});

describe('undocksOf', () => {
  it('sends the working crew first, then each satellite, a beat apart after the exit starts', () => {
    const undocks = undocksOf([
      leaving({ crew: crew('working'), satellites: [satellite('a'), satellite('b')] }),
    ]);

    expect(undocks.map((each) => [each.kind, each.key, each.name])).toEqual([
      ['crew', 'crew:7', 'Crew'],
      ['satellite', 'a', 'agent a'],
      ['satellite', 'b', 'agent b'],
    ]);
    const times = undocks.map((each) => each.startAt);
    expect(times[0]).toBeGreaterThan(100);
    expect(times[1]).toBeGreaterThan(times[0]);
    expect(times[2]).toBeGreaterThan(times[1]);
    expect(undocks.every((each) => each.pr === 7)).toBe(true);
    expect(undocks[0].from).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('casts off when the star begins to go, so a longer prelude moves the cast-off with it', () => {
    const [undock] = undocksOf([leaving({ satellites: [satellite('a')] })]);
    const goesAt = exitBeat(leaving({}), 'begin') ?? 0;

    expect(goesAt).toBe(100 + PRELUDE_S);
    expect(undock.startAt).toBeGreaterThan(goesAt);
    expect(undock.startAt - goesAt).toBeLessThan(1);
  });

  it('has no ship to send for a crew already back from its run', () => {
    expect(undocksOf([leaving({ crew: crew('succeeded') })])).toEqual([]);
    expect(undocksOf([leaving({ crew: crew('failed') })])).toEqual([]);
  });

  it('sends nothing for a star that carried nothing, or an event not yet playing', () => {
    expect(undocksOf([leaving({})])).toEqual([]);
    expect(undocksOf([leaving({ satellites: [satellite('a')] }, { startAt: undefined })])).toEqual(
      [],
    );
  });

  it('sends nothing for news with no departure, as an opened or blocked star has', () => {
    const { departure, ...stayed } = leaving({ satellites: [satellite('a')] });

    expect(departure).toBeDefined();
    expect(undocksOf([{ ...stayed, kind: 'blocked' }])).toEqual([]);
  });

  it('keeps each pull request’s company with its own exit', () => {
    const undocks = undocksOf([
      leaving({ satellites: [satellite('a')] }, { pr: 7, startAt: 100 }),
      leaving({ satellites: [satellite('b')] }, { pr: 8, startAt: 200 }),
    ]);

    expect(undocks.map((each) => [each.pr, Math.floor(each.startAt / 100)])).toEqual([
      [7, 1],
      [8, 2],
    ]);
  });
});

describe('flightOf', () => {
  const crewShip = { kind: 'crew', startAt: 10 } as const;
  const satelliteShip = { kind: 'satellite', startAt: 10 } as const;

  it('waits at the star until it casts off', () => {
    expect(flightOf(crewShip, 9)).toEqual({ stage: 'docked', p: 0, since: -1 });
  });

  it('flies for as long as its kind takes, then is home', () => {
    const halfway = flightOf(satelliteShip, 10 + FLIGHT_S.satellite / 2);
    expect(halfway.stage).toBe('flying');
    expect(halfway.p).toBeCloseTo(0.5);

    expect(flightOf(satelliteShip, 10 + FLIGHT_S.satellite + 0.01).stage).toBe('home');
    expect(flightOf(crewShip, 10 + FLIGHT_S.satellite).stage).toBe('flying');
    expect(flightOf(crewShip, 10 + FLIGHT_S.crew + 0.01).stage).toBe('home');
  });
});

describe('stillAway', () => {
  it('drops the ones that are home', () => {
    const at = (startAt: number): Undock => ({
      kind: 'satellite',
      key: `s${startAt}`,
      pr: 7,
      name: 'agent',
      from: { x: 0, y: 0, z: 0 },
      startAt,
    });

    expect(stillAway([at(0), at(8), at(20)], 10).map((each) => each.key)).toEqual(['s8', 's20']);
  });
});

describe('flightPoint', () => {
  const from = { x: 0, y: 100 };
  const to = { x: 200, y: 0 };

  it('starts at one place and ends at the other', () => {
    expect(flightPoint(from, to, 0)).toEqual(from);
    expect(flightPoint(from, to, 1)).toEqual(to);
  });

  it('leaves and arrives slowly, covering the middle fastest', () => {
    const early = flightPoint(from, to, 0.1).x;
    const middle = flightPoint(from, to, 0.5).x;
    const late = flightPoint(from, to, 0.9).x;

    expect(early).toBeLessThan(20);
    expect(middle).toBeCloseTo(100);
    expect(late).toBeGreaterThan(180);
  });
});

describe('departedRadius', () => {
  it('follows the zoom but never shrinks past a floor', () => {
    expect(departedRadius(2)).toBeGreaterThan(departedRadius(1));
    expect(departedRadius(0.1)).toBe(departedRadius(0.2));
  });
});

describe('undockCues', () => {
  const at = (key: string, startAt: number, kind: Undock['kind'] = 'satellite'): Undock => ({
    kind,
    key,
    pr: 7,
    name: key,
    from: { x: 0, y: 0, z: 0 },
    startAt,
  });
  const env = (fields: Partial<Parameters<typeof undockCues>[1]> = {}) => ({
    now: 50,
    width: 1000,
    frozen: false,
    project: (x: number) => ({ x: x + 100 }),
    ...fields,
  });

  it('fires each engine as its ship casts off, from the side its star stood on', () => {
    const cues = undockCues([at('a', 51.5, 'crew'), at('b', 49)], env());

    expect(cues[0].kind).toBe('crew');
    expect(cues[0].delayS).toBeCloseTo(1.5);
    expect(cues[0].pan).toBeCloseTo(-0.64);
    expect(cues[1].delayS).toBe(0);
  });

  it('keeps to four engines', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((key, i) => at(key, 51 + i));

    expect(undockCues(many, env())).toHaveLength(4);
  });

  it('is silent when motion is off, since nothing flies', () => {
    expect(undockCues([at('a', 51)], env({ frozen: true }))).toEqual([]);
  });
});
