import { Collision } from '../../core/queue/collisions-report';
import { QueueItem, shownBucket } from '../../core/queue/queue-report';
import { SkyPair } from './engine/collision-layer';
import { SkyItem } from './engine/sky-model';

/** An open pull request in the shape pr-starmap's sky charts. */
export const skyItemOf = (item: QueueItem): SkyItem => ({
  pr: item.number,
  title: item.title,
  bucket: shownBucket(item),
  idleDays: item.idleDays,
  additions: item.additions,
  deletions: item.deletions,
  issues: item.closes,
});

/** A collision as a thread between stars: `null` conflicts means never checked. */
export const skyPairOf = (pair: Collision): SkyPair => ({
  a: pair.a,
  b: pair.b,
  conflict: pair.conflicts === null ? null : pair.conflicts.length > 0,
  conflictFiles: pair.conflicts ?? undefined,
  sharedCount: pair.files.length,
});
