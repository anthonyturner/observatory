import { LimitWindow, UsageLimits } from '../../../core/usage/usage-document';
import { TileView, tileOf } from './usage-tile-view';
import { percentText, whenText } from './usage-text';

/** From here the five-hour window's tile turns amber. */
const FIVE_HOUR_WARN = 80;
const FULL = 100;
const UNKNOWN = '—';

const resetWhen = (window: LimitWindow, locale?: string): string =>
  whenText(Date.parse(window.resetsAt), locale);

function weekTile(week: LimitWindow, locale?: string): TileView {
  return week.expired
    ? tileOf('This week', UNKNOWN, `reset ${resetWhen(week, locale)}; nothing read since`)
    : tileOf('This week', percentText(week.pct), `resets ${resetWhen(week, locale)}`);
}

function paceTile(week: LimitWindow, locale?: string): TileView {
  const projection = week.projection;
  if (week.expired) return tileOf('Pace', UNKNOWN, 'a new week starts with the next reading');
  if (!projection) return tileOf('Pace', UNKNOWN, 'needs an hour of readings');
  if (projection.fullAt) {
    const when = whenText(Date.parse(projection.fullAt), locale);
    return {
      ...tileOf('Pace', '▲ runs out', `at this pace, ${when}, before the reset`),
      isWarn: true,
    };
  }
  return tileOf(
    'Pace',
    percentText(projection.atReset),
    `at reset, if the last two days' pace holds (${projection.perHour ?? 0}% an hour)`,
  );
}

function fiveHourTile(five: LimitWindow, locale?: string): TileView {
  if (five.expired) {
    return tileOf('5-hour window', UNKNOWN, `reset ${resetWhen(five, locale)}; nothing read since`);
  }
  return {
    ...tileOf('5-hour window', percentText(five.pct), `resets ${resetWhen(five, locale)}`),
    isWarn: five.pct >= FIVE_HOUR_WARN,
    meter: Math.min(FULL, five.pct),
  };
}

/** The plan-limit tiles: this week and its pace, then the five-hour window. */
export function limitTiles(limits: UsageLimits, locale?: string): TileView[] {
  const { week, five } = limits;
  return [
    ...(week ? [weekTile(week, locale), paceTile(week, locale)] : []),
    ...(five ? [fiveHourTile(five, locale)] : []),
  ];
}
