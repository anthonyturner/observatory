import { isCount, isObject, isString, listOf } from './pull-detail-parts';

/** The design red flags the server's diff scan finds, as `GET /api/weather` names them. */
export type FlagKind = 'swallowed-error' | 'pass-through' | 'silenced-check' | 'untracked-todo';

/** One red flag on a line the pull request adds. */
export interface DesignFlag {
  readonly kind: FlagKind;
  readonly path: string;
  readonly line: number;
  /** What was found: "empty catch", "`read` only forwards to `store.read`". */
  readonly note: string;
  /** The added line, trimmed. */
  readonly excerpt: string;
}

/** One open pull request's red flags at its head commit. */
export interface PullWeather {
  readonly number: number;
  readonly headSha: string;
  /** False when its diff could not be read (too large, or withheld): it has no weather to show. */
  readonly scanned: boolean;
  readonly flags: readonly DesignFlag[];
}

/** What `GET /api/weather` returns. */
export interface WeatherReport {
  readonly repo: string;
  /** The code is withheld, as from a visitor to a private repository. */
  readonly hidden: boolean;
  readonly pulls: readonly PullWeather[];
}

/** Each pull request's weather by its number. */
export type WeatherByPull = ReadonlyMap<number, PullWeather>;

/** What a flag teaches: its name, the principle it breaks, and how heavily it counts. */
export interface FlagLesson {
  readonly title: string;
  readonly principle: string;
  /** How much one adds to the storm; a hidden error outweighs a forgotten note. */
  readonly weight: number;
}

/** The red flags of docs/design-principles.md, in words for the card. */
export const FLAG_LESSONS: Readonly<Record<FlagKind, FlagLesson>> = {
  'swallowed-error': {
    title: 'Error discarded',
    principle: 'Define errors out of existence, but never swallow one that matters.',
    weight: 3,
  },
  'pass-through': {
    title: 'Pass-through method',
    principle: 'Make modules deep: a method that only forwards adds interface and hides nothing.',
    weight: 2,
  },
  'silenced-check': {
    title: 'Check switched off',
    principle: 'Allow zero small kludges: fix what the check found, or say why it is wrong.',
    weight: 2,
  },
  'untracked-todo': {
    title: 'TODO with no issue',
    principle: 'Never leave a hack in silently: file the follow-up and name its issue.',
    weight: 1,
  },
};

const isKind = (value: unknown): value is FlagKind => isString(value) && value in FLAG_LESSONS;

function parseFlag(value: unknown): DesignFlag | null {
  if (!isObject(value)) return null;
  const { kind, path, line, note, excerpt } = value;
  if (!isKind(kind) || !isString(path) || !isCount(line)) return null;
  return {
    kind,
    path,
    line,
    note: isString(note) ? note : '',
    excerpt: isString(excerpt) ? excerpt : '',
  };
}

function parsePull(value: unknown): PullWeather | null {
  if (!isObject(value) || !isCount(value['number']) || !isString(value['headSha'])) return null;
  return {
    number: value['number'],
    headSha: value['headSha'],
    scanned: value['scanned'] === true,
    flags: listOf(value['flags'], parseFlag),
  };
}

/** Reads the answer defensively; one without a list of pull requests is no answer. */
export function parseWeatherReport(value: unknown): WeatherReport | null {
  if (!isObject(value) || !isString(value['repo']) || !Array.isArray(value['pulls'])) return null;
  return {
    repo: value['repo'],
    hidden: value['hidden'] === true,
    pulls: listOf(value['pulls'], parsePull),
  };
}

/** How heavily a pull request's flags weigh, 0 for none or for one not scanned. */
export const flagWeight = (weather: PullWeather | undefined): number =>
  weather?.scanned
    ? weather.flags.reduce((sum, flag) => sum + FLAG_LESSONS[flag.kind].weight, 0)
    : 0;
