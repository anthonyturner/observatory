import { HOT_PERCENT, clampPercent, hasReset } from '../../core/usage/limit-window';
import { LimitWindow } from '../../core/usage/usage-document';
import { formatPercent, hoursMinutes, weekdayTime } from '../../core/usage/usage-format';
import { UsageState } from '../../core/usage/usage-reader';

/** One limit as the strip draws it. An unknown limit reads "—" with an empty meter. */
export interface LimitGlance {
  readonly id: 'five' | 'week';
  readonly label: string;
  readonly title: string;
  readonly text: string;
  /** How full the meter is, 0–100. */
  readonly fill: number;
  readonly isHot: boolean;
}

/** The higher of the two limits, for the folded chip. */
export interface PeakGlance {
  readonly text: string;
  readonly isHot: boolean;
}

/** Claude Code usage at a glance. */
export interface UsageGlance {
  readonly limits: readonly [LimitGlance, LimitGlance];
  /** When the limit nearer its ceiling resets, or null while neither is known. */
  readonly reset: string | null;
  readonly peak: PeakGlance;
}

const UNKNOWN = '—';

interface LimitKind {
  readonly id: LimitGlance['id'];
  readonly label: string;
  readonly title: string;
  readonly resetText: (resetsAt: number, locale?: string) => string;
}

const FIVE_HOUR: LimitKind = {
  id: 'five',
  label: '5h',
  title: '5-hour window',
  resetText: (resetsAt) => hoursMinutes(resetsAt),
};

const WEEKLY: LimitKind = {
  id: 'week',
  label: 'wk',
  title: 'Weekly limit',
  resetText: weekdayTime,
};

/** A limit still current: one that has not reset since it was read. */
interface CurrentLimit {
  readonly kind: LimitKind;
  readonly window: LimitWindow;
}

/** Maps where usage stands to the strip's two limits. Null while there is
 *  nothing to show, so the strip hides rather than drawing a broken widget. A
 *  limit that has reset or was never read reads as unknown, never a number. */
export function usageGlance(state: UsageState, now: number, locale?: string): UsageGlance | null {
  if (state.status !== 'ready') return null;
  const limits = state.document.limits;
  const current = [
    currentLimit(FIVE_HOUR, limits?.five, now),
    currentLimit(WEEKLY, limits?.week, now),
  ];
  const nearest = nearestCeiling(current);
  return {
    limits: [glanceOf(FIVE_HOUR, current[0]), glanceOf(WEEKLY, current[1])],
    reset: nearest ? resetOf(nearest, locale) : null,
    peak: nearest ? peakOf(nearest.window.pct) : { text: UNKNOWN, isHot: false },
  };
}

function currentLimit(
  kind: LimitKind,
  window: LimitWindow | undefined,
  now: number,
): CurrentLimit | null {
  return window && !hasReset(window, now) ? { kind, window } : null;
}

/** The current limit with the most used; the five-hour on a tie, as it resets first. */
function nearestCeiling(current: readonly (CurrentLimit | null)[]): CurrentLimit | null {
  return current.reduce<CurrentLimit | null>(
    (nearest, limit) =>
      limit && (!nearest || limit.window.pct > nearest.window.pct) ? limit : nearest,
    null,
  );
}

function glanceOf(kind: LimitKind, limit: CurrentLimit | null): LimitGlance {
  const { id, label, title } = kind;
  if (!limit) return { id, label, title, text: UNKNOWN, fill: 0, isHot: false };
  const { pct } = limit.window;
  return { id, label, title, ...peakOf(pct), fill: clampPercent(pct) };
}

function peakOf(percent: number): PeakGlance {
  return { text: `${formatPercent(percent)}%`, isHot: percent >= HOT_PERCENT };
}

function resetOf({ kind, window }: CurrentLimit, locale?: string): string {
  return `${kind.label} resets ${kind.resetText(Date.parse(window.resetsAt), locale)}`;
}
