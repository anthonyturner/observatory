import { QueueBucket } from '../../core/queue/queue-report';

/** How each bucket reads on the page: pr-starmap's star names, what they mean, their colour. */
export const BUCKET_LOOK: Record<
  QueueBucket,
  { name: string; meaning: string; why: string; color: string }
> = {
  conflicted: {
    name: 'Aporia',
    meaning: 'Cannot merge',
    why: 'Every merge into the base widens the gap.',
    color: 'var(--count-conflicted)',
  },
  failing: {
    name: 'Ruina',
    meaning: 'Checks failing',
    why: 'A check reported failure, error or timeout.',
    color: 'var(--count-failing)',
  },
  unknown: {
    name: 'Nebulosa',
    meaning: 'Mergeability unknown',
    why: 'GitHub has not settled whether this still merges.',
    color: 'var(--count-unknown)',
  },
  unlinked: {
    name: 'Vagrans',
    meaning: 'No issue linked',
    why: 'Merging it closes no issue, so the work reads as unfinished.',
    color: 'var(--count-unlinked)',
  },
  unreviewed: {
    name: 'Vigilia',
    meaning: 'Waiting on you',
    why: 'Ready for a review: oldest first.',
    color: 'var(--count-unreviewed)',
  },
  fresh: {
    name: 'Quies',
    meaning: 'Seen recently',
    why: 'You have looked at it: context, not a demand.',
    color: 'var(--ok)',
  },
};
