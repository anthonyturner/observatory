/** How careful a review a pull request needs, judged from what it changes. */
export type RiskLevel = 'low' | 'medium' | 'high';

/** What makes a change risky, in the order a glance names them. */
export const RISK_REASONS = [
  'auth',
  'migrations',
  'config',
  'CI',
  'dependencies',
  'broad',
] as const;
export type RiskReason = (typeof RISK_REASONS)[number];

export interface RiskFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

/** A pull request's changed files and their totals; GitHub lists only the first files of a large one. */
export interface RiskChange {
  readonly files: readonly RiskFile[];
  readonly changedFiles: number;
  readonly additions: number;
  readonly deletions: number;
}

export interface RiskRating {
  readonly level: RiskLevel;
  readonly reasons: readonly RiskReason[];
}

/** Any one of these alone makes a change high risk. */
const HIGH_REASONS: ReadonlySet<RiskReason> = new Set(['auth', 'migrations']);
/** This many lesser reasons together make a change high risk. */
const PILED_UP_REASONS = 3;

/** Past any of these a change is broad: too much for one careful read. */
const BROAD_FILES = 25;
const BROAD_LINES = 1000;
const BROAD_AREAS = 5;

const AUTH_WORDS: ReadonlySet<string> = new Set([
  'auth',
  'authn',
  'authz',
  'oauth',
  'login',
  'logout',
  'signin',
  'signout',
  'session',
  'sessions',
  'password',
  'passwords',
  'credential',
  'credentials',
  'secret',
  'secrets',
  'permission',
  'permissions',
  'security',
  'crypto',
  'jwt',
  'cookie',
  'cookies',
]);
const MIGRATION_WORDS: ReadonlySet<string> = new Set(['migration', 'migrations', 'migrate']);
const MIGRATION_NAME = /\.sql$|^schema\.prisma$/;
const CI_FOLDERS: ReadonlySet<string> = new Set(['.circleci', '.buildkite', '.husky']);
const CI_PATH = /^\.github\/(workflows|actions)\//;
const CI_NAMES: ReadonlySet<string> = new Set([
  '.gitlab-ci.yml',
  '.travis.yml',
  'azure-pipelines.yml',
  'bitbucket-pipelines.yml',
  'jenkinsfile',
]);
const DEPENDENCY_NAMES: ReadonlySet<string> = new Set([
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'pipfile',
  'pipfile.lock',
  'poetry.lock',
  'go.mod',
  'go.sum',
  'cargo.toml',
  'cargo.lock',
  'gemfile',
  'gemfile.lock',
  'composer.json',
  'composer.lock',
  'packages.config',
  'directory.packages.props',
]);
const DEPENDENCY_NAME = /^requirements[\w-]*\.txt$|\.csproj$/;
const CONFIG_FOLDERS: ReadonlySet<string> = new Set(['config', 'configs']);
const CONFIG_NAMES: ReadonlySet<string> = new Set([
  'angular.json',
  'vercel.json',
  'netlify.toml',
  'firebase.json',
  'proxy.conf.json',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'nginx.conf',
  'settings.json',
]);
const CONFIG_NAME =
  /^\.env|^tsconfig.*\.json$|\.config\.(js|cjs|mjs|ts|json)$|^\.(eslintrc|prettierrc|babelrc|npmrc|nvmrc)/;
/** Tests and prose can be wrong, but cannot break what runs, so they never raise the risk. */
const TEST_OR_DOC_NAME = /\.(spec|test)\.[a-z]+$|\.(md|mdx|rst)$/;
const TEST_OR_DOC_FOLDERS: ReadonlySet<string> = new Set([
  'test',
  'tests',
  '__tests__',
  'e2e',
  'fixtures',
  'docs',
]);

/** A path's parts, lower case, with forward slashes. */
interface PathParts {
  readonly path: string;
  readonly folders: readonly string[];
  readonly name: string;
  /** The words of every part, and each two neighbours run together: `sign-in` is `signin`. */
  readonly words: ReadonlySet<string>;
}

function wordsOf(part: string): string[] {
  const words = part.split(/[-_. ]+/).filter(Boolean);
  return [...words, ...words.slice(1).map((word, n) => words[n] + word)];
}

function partsOf(raw: string): PathParts {
  const path = raw.replace(/\\/g, '/').toLowerCase();
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  return { path, folders: segments.slice(0, -1), name, words: new Set(segments.flatMap(wordsOf)) };
}

const hasAny = (words: ReadonlySet<string>, wanted: ReadonlySet<string>): boolean =>
  [...words].some((word) => wanted.has(word));

const inFolder = (parts: PathParts, folders: ReadonlySet<string>): boolean =>
  parts.folders.some((folder) => folders.has(folder));

const isTestOrDoc = (parts: PathParts): boolean =>
  TEST_OR_DOC_NAME.test(parts.name) || inFolder(parts, TEST_OR_DOC_FOLDERS);

/** Whether a path is a test, a fixture or prose: code that cannot break what runs. */
export const isTestOrDocPath = (path: string): boolean => isTestOrDoc(partsOf(path));

/** The reasons one file gives, except breadth, which only the whole change can show. */
const FILE_RULES: readonly (readonly [RiskReason, (parts: PathParts) => boolean])[] = [
  ['auth', (parts) => hasAny(parts.words, AUTH_WORDS)],
  ['migrations', (parts) => MIGRATION_NAME.test(parts.name) || inFolder(parts, MIGRATION_WORDS)],
  [
    'config',
    (parts) =>
      CONFIG_NAMES.has(parts.name) ||
      CONFIG_NAME.test(parts.name) ||
      inFolder(parts, CONFIG_FOLDERS),
  ],
  [
    'CI',
    (parts) => CI_PATH.test(parts.path) || CI_NAMES.has(parts.name) || inFolder(parts, CI_FOLDERS),
  ],
  ['dependencies', (parts) => DEPENDENCY_NAMES.has(parts.name) || DEPENDENCY_NAME.test(parts.name)],
];

function fileReasons(parts: PathParts): RiskReason[] {
  if (isTestOrDoc(parts)) return [];
  return FILE_RULES.filter(([, applies]) => applies(parts)).map(([reason]) => reason);
}

/** The top-level folders a change reaches into, the root counting as one. */
const areasOf = (all: readonly PathParts[]): number =>
  new Set(all.map((parts) => parts.folders[0] ?? '')).size;

function isBroad(change: RiskChange, all: readonly PathParts[]): boolean {
  return (
    Math.max(change.changedFiles, change.files.length) >= BROAD_FILES ||
    change.additions + change.deletions >= BROAD_LINES ||
    areasOf(all) >= BROAD_AREAS
  );
}

function levelOf(reasons: readonly RiskReason[]): RiskLevel {
  if (reasons.some((reason) => HIGH_REASONS.has(reason)) || reasons.length >= PILED_UP_REASONS) {
    return 'high';
  }
  return reasons.length ? 'medium' : 'low';
}

/** How risky a change is, and why, from its file paths and sizes alone. */
export function riskOf(change: RiskChange): RiskRating {
  const all = change.files.map((file) => partsOf(file.path));
  const found = new Set(all.flatMap(fileReasons));
  if (isBroad(change, all)) found.add('broad');
  const reasons = RISK_REASONS.filter((reason) => found.has(reason));
  return { level: levelOf(reasons), reasons };
}
