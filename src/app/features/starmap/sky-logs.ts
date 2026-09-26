import { LogSkyLayout, LogStar } from '../../core/logs/log-layout';
import { rnd } from './engine/rnd';
import { SkyLayout } from './engine/sky-layout';
import { SkyCluster, SkyStar } from './engine/sky-model';

/**
 * Feeds the Log Sky's layout into the engine: each window a constellation,
 * each fault a star made with the rest of its window's random sequence, so it
 * twinkles and drifts exactly as pr-starmap's did. Each star carries its
 * LogStar, for picking.
 */
export function feedLogs(layout: LogSkyLayout, sky: SkyLayout): void {
  for (const window of layout.clusters) {
    const cluster: SkyCluster = {
      cx: window.cx,
      cy: window.cy,
      z: window.z,
      labelY: window.labelY,
      colour: window.colour,
      label: window.label,
      sub: window.sub,
      stars: [],
    };
    for (const star of window.stars) {
      sky.makeStar(
        {
          kind: star.kind,
          key: star.key,
          urgent: star.urgent,
          tag: star.tag,
          caption: star.caption,
          x: star.x,
          y: star.y,
          mag: star.mag,
          colour: star.colour,
          cluster,
          data: star,
        },
        rnd(star.seed),
        star.driftRadius,
      );
    }
    sky.clusters.push(cluster);
  }
}

/** The LogStar a sky star stands for, if it is one. */
export const logStarOf = (star: SkyStar | null): LogStar | null =>
  star && (star.kind === 'fault' || star.kind === 'quiet') ? (star.data as LogStar) : null;
