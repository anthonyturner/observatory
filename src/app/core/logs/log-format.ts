// pr-starmap's number and date wording for the log sky. Times in a log have no
// zone: they are read and shown in the viewer's own, as pr-starmap does.

/** `desktop_overlay` reads as `desktop overlay`. */
export const windowName = (id: string): string => id.replace(/_/g, ' ');

/** `776,900` in the viewer's locale. */
export const formatCount = (count: number, locale?: string): string =>
  Number(count).toLocaleString(locale);

/** `Sep 23, 01:43 AM`: a log time with its day. */
export const formatAt = (at: string, locale?: string): string =>
  new Date(Date.parse(at)).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** A bare date parses as UTC midnight, which is the previous evening west of
 *  Greenwich; noon keeps it on its own day everywhere. */
const BARE_DATE_LENGTH = 10;

/** `Sep 23`, from a day or a log time. */
export const formatDay = (day: string, locale?: string): string =>
  new Date(
    Date.parse(day.length === BARE_DATE_LENGTH ? `${day}T12:00:00` : day),
  ).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

/** When the snapshot was read: `9/26/2026, 4:49:12 AM`. */
export const formatRefreshed = (iso: string, locale?: string): string =>
  new Date(iso).toLocaleString(locale);
