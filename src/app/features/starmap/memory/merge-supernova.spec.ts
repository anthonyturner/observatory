import {
  MERGE_SPAN_S,
  NOVA_S,
  mergeCues,
  novaLook,
  novaProgress,
  streakProgress,
} from './merge-supernova';

describe('the merge supernova', () => {
  it('goes off first, then hands over to the streak', () => {
    const handover = NOVA_S / MERGE_SPAN_S;

    expect(novaProgress(-0.1)).toBeNull();
    expect(novaProgress(handover / 2)).toBeCloseTo(0.5);
    expect(novaProgress(handover + 0.01)).toBeNull();
    expect(streakProgress(handover / 2)).toBe(0);
    expect(streakProgress(handover)).toBeCloseTo(0);
    expect(streakProgress(1)).toBe(1);
  });
});

describe('novaLook', () => {
  it('flares bright and small, then spreads thin and fades', () => {
    const start = novaLook(0);
    const end = novaLook(1);

    expect(start.flashAlpha).toBeGreaterThan(0.8);
    expect(end.flashAlpha).toBe(0);
    expect(end.ringAlpha).toBe(0);
    expect(end.ringRadius).toBeGreaterThan(start.ringRadius * 5);
  });
});

describe('mergeCues', () => {
  const width = 1000;
  const at = (x: number) => (): [number, number] => [x, 0];
  const merged = (startAt: number) => ({ kind: 'merged', startAt, fromX: 0, fromY: 0, fromZ: 0 });

  it('waits for the supernova and sits where it happens on screen', () => {
    const [left] = mergeCues([merged(12.5)], { now: 10, width, toScreen: at(250) });
    const [edge] = mergeCues([merged(10)], { now: 10, width, toScreen: at(1000) });

    expect(left).toEqual({ delayS: 2.5, pan: -0.5 });
    expect(edge.pan).toBe(0.8);
  });

  it('never goes backwards in time or off the screen', () => {
    const [late] = mergeCues([merged(8)], { now: 10, width, toScreen: at(-400) });
    const [blind] = mergeCues([merged(10)], { now: 10, width: 0, toScreen: at(300) });

    expect(late).toEqual({ delayS: 0, pan: -0.8 });
    expect(blind.pan).toBe(0);
  });

  it('cues only merges that have started playing, and not too many', () => {
    const news = [
      { kind: 'blocked', startAt: 10 },
      { kind: 'merged' },
      ...Array.from({ length: 6 }, (_, i) => merged(10 + i)),
    ];

    expect(mergeCues(news, { now: 10, width, toScreen: at(500) })).toHaveLength(4);
    expect(mergeCues([], { now: 10, width, toScreen: at(500) })).toEqual([]);
  });
});
