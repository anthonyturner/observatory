import { layoutLogs } from '../../core/logs/log-layout';
import { LOG_FIXTURE, TEST_PALETTE } from '../../core/logs/testing/log-fixture';
import { SkyLayout } from './engine/sky-layout';
import { feedLogs, logStarOf } from './sky-logs';

describe('feedLogs', () => {
  it('makes each window a constellation and each fault a star, in layout order', () => {
    const layout = layoutLogs(LOG_FIXTURE, TEST_PALETTE);
    const sky = new SkyLayout();

    feedLogs(layout, sky);

    expect(sky.clusters.map((c) => c.label)).toEqual(layout.clusters.map((c) => c.label));
    expect(sky.stars.length).toBe(layout.stars.length);
    expect(sky.stars.map((s) => [s.x, s.y, s.mag, s.key])).toEqual(
      layout.clusters.flatMap((c) => c.stars.map((s) => [s.x, s.y, s.mag, s.key])),
    );
    expect(sky.clusters.every((c) => c.stars.every((s) => s.cluster === c))).toBe(true);
  });

  it('hands a picked star back as the log star it stands for', () => {
    const layout = layoutLogs(LOG_FIXTURE, TEST_PALETTE);
    const sky = new SkyLayout();
    feedLogs(layout, sky);

    expect(logStarOf(sky.stars[0])).toBe(layout.clusters[0].stars[0]);
    expect(logStarOf(null)).toBeNull();
  });
});
