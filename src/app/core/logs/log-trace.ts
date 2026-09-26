import { LogStar } from './log-layout';
import { LogFault } from './log-snapshot';

// The traced fault is the one whose threads to its twins are drawn and whose
// lifetime the meteor record shades. It is kept apart from the selected star so
// closing the card (× or Esc) leaves the threads up to study. Clicking empty
// sky, picking another star, changing a filter or leaving the log sky clear it;
// going to List and back keeps it.

/** The same fault in another window: the same level and the same message. */
export const isTwin = (other: LogFault, fault: LogFault): boolean =>
  other.id !== fault.id && other.level === fault.level && other.text === fault.text;

/** The fault traced once `picked` is selected: a fault star traces itself, any
 *  other star or empty sky clears the trace. */
export const traceOnPick = (picked: LogStar | null): LogStar | null =>
  picked?.kind === 'fault' ? picked : null;

/** The stars a thread runs to from `traced`: the same fault in every other window. */
export function twinStars(traced: LogStar | null, stars: readonly LogStar[]): LogStar[] {
  const fault = traced?.fault;
  if (!fault) return [];
  return stars.filter(
    (star) => star !== traced && star.fault !== undefined && isTwin(star.fault, fault),
  );
}

/** The same fault after the sky is laid out again: the same window, level and
 *  message, whatever its new rank. */
export function sameFaultStar(was: LogFault, stars: readonly LogStar[]): LogStar | null {
  return (
    stars.find(
      (star) =>
        star.fault?.window === was.window &&
        star.fault.level === was.level &&
        star.fault.text === was.text,
    ) ?? null
  );
}
