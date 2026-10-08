import { mapWithLimit } from '../util/map-with-limit.ts';
import { type DesignFlag, designFlagsOf } from './design-flags.ts';
import type { QueueReport } from './queue-report.ts';

/** One open pull request's design red flags at its head commit. */
export interface PullWeather {
  readonly number: number;
  readonly headSha: string;
  /** False when its diff could not be read, as when GitHub finds it too large. */
  readonly scanned: boolean;
  readonly flags: readonly DesignFlag[];
}

/** What `GET /api/weather` returns: every open pull request's weather. */
export interface WeatherReport {
  readonly repo: string;
  /** The code is withheld, as from a visitor to a private repository: nothing was scanned. */
  readonly hidden: boolean;
  readonly pulls: readonly PullWeather[];
}

export const WEATHER_PATH = '/api/weather';

/** A pull request's unified diff, or null when GitHub would not give it. */
export type DiffRead = (number: number) => Promise<string | null>;

/** Diffs read at once on a repository's first look, so a long queue does not burst GitHub. */
const DIFFS_AT_ONCE = 4;

/** One pull request's weather from its diff, read once per head commit by the caller's cache. */
export async function pullWeatherOf(
  number: number,
  headSha: string,
  diff: DiffRead,
): Promise<PullWeather> {
  const text = await diff(number);
  return { number, headSha, scanned: text !== null, flags: text ? designFlagsOf(text) : [] };
}

/** The weather of every pull request in `queue`, a few diffs at a time. */
export async function weatherReport(
  queue: QueueReport,
  weatherAt: (number: number, headSha: string) => Promise<PullWeather>,
): Promise<WeatherReport> {
  const pulls = await mapWithLimit(queue.items, DIFFS_AT_ONCE, (item) =>
    weatherAt(item.number, item.headSha),
  );
  return { repo: queue.repo, hidden: false, pulls };
}

/** The queue's weather with nothing scanned, for whoever may not read the code: no diff is read. */
export const hiddenWeather = (queue: QueueReport): WeatherReport => ({
  repo: queue.repo,
  hidden: true,
  pulls: queue.items.map((item) => ({
    number: item.number,
    headSha: item.headSha,
    scanned: false,
    flags: [],
  })),
});
