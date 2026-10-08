import { parseDeploymentsReport } from '../../../core/deployments/deployments-report';
import { RAW_REPORT, rawDeployment } from '../../../core/deployments/testing/deployments-fixture';
import { launchMarks } from './launch-marks';
import { BEACON_RADIUS_PX, layoutPads, trailAlpha, trailRadius } from './launch-pads';

const STAGE = { left: 0, top: 100, width: 1000, height: 600 };
const report = parseDeploymentsReport(RAW_REPORT)!;

describe('layoutPads', () => {
  it('stands each environment’s pad along the foot, centred, no further apart than the cap', () => {
    const { pads } = layoutPads(report.environments, STAGE);

    expect(pads.map((pad) => [pad.name, pad.x, pad.y, pad.latest, pad.count])).toEqual([
      ['Production', 340, 616, 'ready', 1],
      ['Preview', 660, 616, 'building', 2],
    ]);
    expect(pads[0].isProduction).toBe(true);
  });

  it('puts the latest deployment on its beam above the pad and the earlier ones up a trail', () => {
    const { deployments } = layoutPads(report.environments, STAGE);
    const preview = deployments.filter((light) => light.padKey === 'Preview');

    expect(preview.map((light) => [light.age, light.radius, light.alpha])).toEqual([
      [0, BEACON_RADIUS_PX, 1],
      [1, trailRadius(1), trailAlpha(1)],
    ]);
    expect(preview[0].x).toBe(660);
    expect(preview[0].y).toBeLessThan(616);
    expect(preview[1].y).toBeLessThan(preview[0].y);
  });

  it('shrinks and dims the trail with age, never past a floor', () => {
    expect(trailRadius(1)).toBeGreaterThan(trailRadius(2));
    expect(trailRadius(40)).toBeCloseTo(2.4);
    expect(trailAlpha(2)).toBeLessThan(trailAlpha(1));
    expect(trailAlpha(40)).toBeCloseTo(0.3);
  });

  it('keeps every light inside the stage, a full history included', () => {
    const history = Array.from({ length: 8 }, (_, index) =>
      rawDeployment(index + 1, 'Preview', 'ready'),
    );
    const full = parseDeploymentsReport({
      ...RAW_REPORT,
      environments: [{ ...RAW_REPORT.environments[1], deployments: history }],
    })!;

    const { deployments } = layoutPads(full.environments, STAGE);

    for (const light of deployments) {
      expect(light.y).toBeGreaterThanOrEqual(STAGE.top);
      expect(light.x).toBeGreaterThanOrEqual(STAGE.left);
      expect(light.x).toBeLessThanOrEqual(STAGE.left + STAGE.width);
    }
  });

  it('lays nothing out on an empty stage or with no environments', () => {
    expect(layoutPads(report.environments, { ...STAGE, width: 0 }).pads).toEqual([]);
    expect(layoutPads([], STAGE).deployments).toEqual([]);
  });
});

describe('launchMarks', () => {
  it('links each light to its site, or its commit when it has none, and names each pad', () => {
    const marks = launchMarks(layoutPads(report.environments, STAGE), report.generatedAt);

    expect(marks.lights.map((light) => light.href)).toEqual([
      'https://app-5.vercel.app',
      `https://github.com/me/app/commit/${'4'.padEnd(40, 'a')}`,
      'https://app-3.vercel.app',
    ]);
    expect(marks.lights[1].tip).toBe('Preview · Building · 4aaaaaa · 1h ago');
    expect(marks.lights[1].spoken).toBe(
      'Preview, building, commit 4aaaaaa, 1h ago. Opens the commit on GitHub.',
    );
    expect(marks.pads.map((pad) => [pad.name, pad.detail, pad.colour])).toEqual([
      ['Production', 'production · 1 deployment', 'var(--actions-passed)'],
      ['Preview', '2 deployments', 'var(--meh)'],
    ]);
  });
});
