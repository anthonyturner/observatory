import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FLAG_LESSONS, PullWeather } from '../../../../core/queue/weather';
import { StormLevel, stormOf } from '../../engine/weather-layer';

/** Flags listed on the card; the rest are counted. */
const SHOWN_FLAGS = 5;

const LEVEL_NAMES: Readonly<Record<StormLevel, string>> = {
  haze: 'Haze',
  squall: 'Squall',
  storm: 'Storm',
};

/** One flag as the card lists it. */
interface FlagRow {
  readonly key: string;
  readonly title: string;
  readonly place: string;
  readonly note: string;
  readonly excerpt: string;
  readonly principle: string;
}

/** What the card says about a pull request's weather. */
type WeatherView =
  | { readonly kind: 'unscanned' }
  | { readonly kind: 'clear' }
  | {
      readonly kind: 'stormy';
      readonly heading: string;
      readonly rows: readonly FlagRow[];
      readonly more: number;
    };

const flagCount = (count: number): string => `${count} red flag${count === 1 ? '' : 's'}`;

function viewOf(weather: PullWeather): WeatherView {
  if (!weather.scanned) return { kind: 'unscanned' };
  const storm = stormOf(weather);
  if (!storm) return { kind: 'clear' };
  const rows = weather.flags.slice(0, SHOWN_FLAGS).map((flag) => ({
    key: `${flag.kind}:${flag.path}:${flag.line}`,
    title: FLAG_LESSONS[flag.kind].title,
    place: `${flag.path}:${flag.line}`,
    note: flag.note,
    excerpt: flag.excerpt,
    principle: FLAG_LESSONS[flag.kind].principle,
  }));
  return {
    kind: 'stormy',
    heading: `${LEVEL_NAMES[storm.level]} · ${flagCount(weather.flags.length)}`,
    rows,
    more: weather.flags.length - rows.length,
  };
}

/**
 * A pull request's tactical weather on its star card: each design red flag in
 * its added lines, where it is, and the principle it breaks. Shows nothing
 * until the weather is in.
 */
@Component({
  selector: 'app-star-weather',
  templateUrl: './star-weather.html',
  styleUrl: './star-weather.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarWeather {
  readonly weather = input<PullWeather | undefined>(undefined);

  protected readonly view = computed(() => {
    const weather = this.weather();
    return weather ? viewOf(weather) : null;
  });
}
