import { CheckLine, CheckOutcome, ReviewDecision } from '../../core/queue/pull-detail';

/** "2 passed · 1 failed · 1 pending", leaving out the outcomes with none. */
export function checkTally(checks: readonly CheckLine[]): string {
  if (!checks.length) return 'no checks';
  const order: readonly CheckOutcome[] = ['failed', 'pending', 'passed', 'skipped'];
  return order
    .map(
      (outcome) => [outcome, checks.filter((check) => check.outcome === outcome).length] as const,
    )
    .filter(([, count]) => count > 0)
    .map(([outcome, count]) => `${count} ${outcome}`)
    .join(' · ');
}

/** The checks worth naming: the ones that failed, then the ones that have not finished. */
export const checksToName = (checks: readonly CheckLine[]): CheckLine[] => [
  ...checks.filter((check) => check.outcome === 'failed'),
  ...checks.filter((check) => check.outcome === 'pending'),
];

export const DECISION_LABEL: Record<ReviewDecision, string> = {
  approved: 'Approved',
  'changes-requested': 'Changes requested',
  'review-required': 'Review required',
  none: 'No review yet',
};

/** "Sep 26" for a date this year, "Sep 26, 2025" otherwise. */
export function shortDate(iso: string, now: number, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
