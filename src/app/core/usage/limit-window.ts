import { LimitWindow } from './usage-document';

/** At or above this share of a limit, a reading turns amber. */
export const HOT_PERCENT = 80;

const PERCENT_FLOOR = 0;
const PERCENT_CEILING = 100;

/** A percent held to the 0–100 a meter can draw. */
export const clampPercent = (value: number): number =>
  Math.min(PERCENT_CEILING, Math.max(PERCENT_FLOOR, value));

/** Whether the window has reset since it was read, so its percent no longer holds. */
export const hasReset = (window: LimitWindow, now: number): boolean =>
  window.expired === true || Date.parse(window.resetsAt) <= now;
