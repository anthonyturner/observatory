import { BUCKETS } from './sky-model';
import { FLOW_INK, LINK_INK, trimSegment } from './link-ink';

describe('link ink', () => {
  it('never matches a bucket colour', () => {
    const colours = BUCKETS.map((b) => b.colour.toLowerCase());
    expect(colours).not.toContain(LINK_INK);
    expect(colours).not.toContain(FLOW_INK);
  });
});

describe('trimSegment', () => {
  const origin = { x: 0, y: 0, z: 0 };

  it('cuts each end back along the segment', () => {
    expect(trimSegment(origin, { x: 10, y: 0, z: 0 }, 2, 3)).toEqual([
      { x: 2, y: 0, z: 0 },
      { x: 7, y: 0, z: 0 },
    ]);
  });

  it('works in depth as well as on the page', () => {
    const [from, to] = trimSegment(origin, { x: 0, y: 6, z: 8 }, 5, 0) ?? [];
    expect(from).toEqual({ x: 0, y: 3, z: 4 });
    expect(to).toEqual({ x: 0, y: 6, z: 8 });
  });

  it('leaves nothing when the stars are closer than their gaps', () => {
    expect(trimSegment(origin, { x: 4, y: 0, z: 0 }, 2, 2)).toBeNull();
  });
});
