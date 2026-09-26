/** A clock reading split so the seconds can be set smaller than the rest. */
export interface ClockFace {
  readonly hoursMinutes: string;
  readonly seconds: string;
}

const twoDigits = (value: number): string => String(value).padStart(2, '0');

export function toClockFace(date: Date): ClockFace {
  return {
    hoursMinutes: `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`,
    seconds: twoDigits(date.getSeconds()),
  };
}

/** "Fri · Sep 25" in the given locale, or the browser's when none is given. */
export function toDayLabel(date: Date, locale?: string): string {
  const weekday = date.toLocaleDateString(locale, { weekday: 'short' });
  const monthDay = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return `${weekday} · ${monthDay}`;
}
