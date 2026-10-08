import { type Principle, PRINCIPLES } from './principles.ts';

/** Every principle, and which of them is the one for the day asked about. */
export interface PrinciplesReport {
  readonly principles: readonly Principle[];
  /** Where the day's principle sits in `principles`. */
  readonly today: number;
}

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** `date`'s calendar day where this process runs, as `YYYY-MM-DD`. */
const localDay = (date: Date): string =>
  `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

/** Days from 1970-01-01 to `day`, or null when `day` is not a real `YYYY-MM-DD` date. */
function dayNumber(day: string): number | null {
  const parts = DAY_PATTERN.exec(day);
  if (!parts) return null;
  const [year, month, date] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const at = new Date(Date.UTC(year, month - 1, date));
  // Date.UTC rolls 2026-02-31 on to March, so a rolled date was never a real one.
  const isReal = at.getUTCMonth() === month - 1 && at.getUTCDate() === date;
  return isReal ? at.getTime() / DAY_MS : null;
}

/** Consecutive days walk the deck in order, so every principle comes round in turn. */
const placeOf = (days: number): number =>
  ((days % PRINCIPLES.length) + PRINCIPLES.length) % PRINCIPLES.length;

/**
 * The deck and the principle for `day`, a `YYYY-MM-DD` calendar day such as a
 * page's own local date. Anything that is not one reads as `now`'s day here,
 * so a caller always gets an answer.
 */
export function principlesOn(day: string | null, now: Date): PrinciplesReport {
  const days = (day === null ? null : dayNumber(day)) ?? dayNumber(localDay(now)) ?? 0;
  return { principles: PRINCIPLES, today: placeOf(days) };
}

/** The principle for `now`'s calendar day here. */
export function principleOfDay(now: Date): Principle {
  const { principles, today } = principlesOn(null, now);
  return principles[today];
}
