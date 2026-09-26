import { ProjectCounts, ProjectSnapshot } from './project.types';

/** One count on a card, with its bar's length relative to the card's largest. */
export interface CountBar {
  readonly count: number;
  readonly label: string;
  readonly color: string;
  readonly widthPercent: number;
}

interface CountKind {
  readonly field: keyof ProjectCounts;
  readonly label: string;
  readonly color: string;
}

const COUNT_KINDS: readonly CountKind[] = [
  { field: 'conflicted', label: 'cannot merge', color: 'var(--count-conflicted)' },
  { field: 'failing', label: 'checks failing', color: 'var(--count-failing)' },
  { field: 'unknown', label: 'mergeability unknown', color: 'var(--count-unknown)' },
  { field: 'unlinked', label: 'no issue linked', color: 'var(--count-unlinked)' },
  { field: 'unreviewed', label: 'waiting on you', color: 'var(--count-unreviewed)' },
  { field: 'unclaimed', label: 'unclaimed issues', color: 'var(--count-unclaimed)' },
];

/** The shortest bar still reads as a bar; the rest scales above it. */
const MIN_BAR_PERCENT = 18;
const SCALED_BAR_PERCENT = 100 - MIN_BAR_PERCENT;

/** The non-zero counts, worst kind first. */
export function countBarsOf({ counts }: ProjectSnapshot): CountBar[] {
  const present = COUNT_KINDS.filter(({ field }) => counts[field] > 0);
  const largest = Math.max(1, ...present.map(({ field }) => counts[field]));
  return present.map(({ field, label, color }) => ({
    count: counts[field],
    label,
    color,
    widthPercent: Math.round(MIN_BAR_PERCENT + (counts[field] / largest) * SCALED_BAR_PERCENT),
  }));
}
