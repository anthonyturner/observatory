import { StarType } from '../../../shared/gl/star-shader';
import { BucketId, SkyStar } from './sky-model';

/** Blocked work swells and flares; an unsettled merge is veiled in gas; work
 *  waiting on you burns clear; what you have seen recently rests. */
const BY_BUCKET: Readonly<Record<BucketId, StarType>> = {
  conflicted: 'giant',
  failing: 'giant',
  unknown: 'veiled',
  unlinked: 'bright',
  unreviewed: 'bright',
  fresh: 'calm',
};

/** Days blocked after which a giant flares as often as it ever will. */
const FULL_FLARE_DAYS = 14;
/** A giant flares a little even on its first day. */
const FIRST_FLARE = 0.25;

export interface StarLook {
  readonly type: StarType;
  /** How restless its surface is, between 0 and 1: flares, for a giant. */
  readonly activity: number;
}

/** A star that stands for no pull request (a log fault, an issue) burns clear and still. */
export function starLook(star: Pick<SkyStar, 'item'>): StarLook {
  if (!star.item) return { type: 'bright', activity: 0 };
  const type = BY_BUCKET[star.item.bucket];
  const days = Math.max(star.item.idleDays, 0);
  return {
    type,
    activity:
      type === 'giant' ? FIRST_FLARE + (1 - FIRST_FLARE) * Math.min(days / FULL_FLARE_DAYS, 1) : 0,
  };
}
