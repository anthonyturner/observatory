import { UNRELEASED_KEY } from '../../../core/releases/release-timeline';
import { PlacedComet, PlacedRelease, TimelineLayout } from './release-layout';
import { Stage } from './release-path';
import { skyMarks } from './sky-marks';
import { releaseLook } from './release-look';

const STAGE: Stage = { left: 0, top: 0, width: 1200, height: 600 };

const release = (tag: string, extra: Partial<PlacedRelease> = {}): PlacedRelease => ({
  key: tag,
  tag,
  publishedAt: new Date(2026, 9, 3).getTime(),
  t: 0.3,
  x: 300,
  y: 200,
  depth: 0.8,
  radius: 6,
  count: 12,
  bump: 'minor',
  isPrerelease: false,
  order: 0,
  hasLabel: true,
  ...extra,
});

const COMET: PlacedComet = {
  key: UNRELEASED_KEY,
  x: 1000,
  y: 300,
  depth: 0.95,
  radius: 18,
  count: 230,
  t: 0.9,
  tailStart: 0.5,
  weeks: [
    {
      key: '2026-09-21',
      start: new Date(2026, 8, 21).getTime(),
      count: 80,
      t: 0.6,
      reach: 0.05,
      x: 0,
      y: 0,
      spread: 30,
    },
    {
      key: '2026-09-28',
      start: new Date(2026, 8, 28).getTime(),
      count: 150,
      t: 0.8,
      reach: 0.05,
      x: 0,
      y: 0,
      spread: 15,
    },
  ],
};

describe('skyMarks', () => {
  it('gives each release a button that names its version, date and count, and the comet last', () => {
    const layout: TimelineLayout = { releases: [release('v1.2.0')], comet: COMET };
    const { bodies, weeks } = skyMarks(layout, STAGE);

    expect(bodies.map((body) => body.key)).toEqual(['v1.2.0', UNRELEASED_KEY]);
    expect(bodies[0].tip).toContain('v1.2.0');
    expect(bodies[0].tip).toContain('12 PRs');
    expect(bodies[0].spoken).toContain('minor release');
    expect(bodies[0].spoken).toContain('12 merged pull requests');
    expect(bodies[0].hit).toBe(32);
    expect(bodies[1].spoken).toBe('Unreleased: 230 merged pull requests not in a release yet');
    expect(weeks.map((week) => week.text)).toEqual([
      expect.stringContaining('· 80'),
      expect.stringContaining('· 150'),
    ]);
  });

  it('leaves a crowded release unnamed, though its tip still says it all', () => {
    const { bodies } = skyMarks(
      { releases: [release('v0.1.0', { hasLabel: false, isPrerelease: true })], comet: null },
      STAGE,
    );

    expect(bodies[0].name).toBeNull();
    expect(bodies[0].tip).toContain('v0.1.0');
    expect(bodies[0].spoken).toContain('prerelease');
  });
});

describe('releaseLook', () => {
  it('draws a major release as a giant, a minor one clear, a patch calm and a prerelease veiled', () => {
    expect(releaseLook({ bump: 'major', isPrerelease: false })).toEqual({
      type: 'giant',
      token: 'release-major',
    });
    expect(releaseLook({ bump: 'minor', isPrerelease: false }).type).toBe('bright');
    expect(releaseLook({ bump: 'patch', isPrerelease: false }).type).toBe('calm');
    expect(releaseLook({ bump: 'minor', isPrerelease: true }).type).toBe('veiled');
  });
});
