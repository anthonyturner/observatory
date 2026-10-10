import { posix } from 'node:path';
import type { ArchitectureRuntime } from './architecture-types.ts';
import { isFolder, isObject, jsonObjectOf, sourceFilesUnder } from './project-files.ts';

/** Where the folders of the app and of the API are, when the project does not say. */
export interface LayoutOptions {
  /** The Angular app's source folder, relative to the project root. */
  readonly browserRoot?: string;
  /** The Node API's source folder, relative to the project root. */
  readonly serverRoot?: string;
}

/** The runtimes found inside a project, and the files that start its code running. */
export interface ProjectLayout {
  readonly runtimes: readonly ArchitectureRuntime[];
  /** Files nothing imports because something else runs them: the app's entry and the scripts' targets. */
  readonly entryFiles: readonly string[];
}

const BROWSER = { id: 'browser', label: 'Browser app', kind: 'browser' } as const;
const SERVER = { id: 'server', label: 'API server', kind: 'server' } as const;

/** The folders a Node API conventionally lives in, in the order they are tried. */
const SERVER_FOLDERS: readonly string[] = ['server', 'backend', 'api'];
const DEFAULT_SOURCE_ROOT = 'src';
/** The folder the Angular CLI puts an app's code in, inside its source root. */
export const APP_FOLDER = 'app';
/** A script file's path; the end of a glob such as `**\/*.spec.ts` is not one. */
const SCRIPT_FILE = /(?<![*\w@./-])[\w@./-]+\.[cm]?[jt]s\b/g;
const LEADING_DOT_SLASH = /^\.\//;

const textOf = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/** The first Angular application in `angular.json`: its source folder and the file that starts it. */
async function angularApplication(
  projectRoot: string,
): Promise<{ sourceRoot: string; entry: string } | null> {
  const config = await jsonObjectOf(projectRoot, 'angular.json');
  const projects = config?.['projects'];
  if (!isObject(projects)) return null;
  const applications = Object.values(projects).filter(isObject);
  const application =
    applications.find((project) => project['projectType'] === 'application') ?? applications[0];
  if (!application) return null;
  const sourceRoot = textOf(application['sourceRoot']) ?? DEFAULT_SOURCE_ROOT;
  const build = isObject(application['architect']) ? application['architect']['build'] : null;
  const options = isObject(build) && isObject(build['options']) ? build['options'] : {};
  const entry = textOf(options['browser']) ?? textOf(options['main']) ?? `${sourceRoot}/main.ts`;
  return { sourceRoot, entry: posix.normalize(entry) };
}

/**
 * The Angular app's code is everything under its source root, which holds
 * more than the `app` folder when the app keeps layers beside it. Without an
 * `angular.json`, only `src/app` counts, since any other `src` could be a
 * Node project.
 */
async function browserRootOf(
  projectRoot: string,
  application: { sourceRoot: string } | null,
): Promise<string | null> {
  const root = application?.sourceRoot ?? posix.join(DEFAULT_SOURCE_ROOT, APP_FOLDER);
  return (await isFolder(projectRoot, root)) ? root : null;
}

async function serverRootOf(projectRoot: string, override?: string): Promise<string | null> {
  if (override !== undefined) {
    if ((await sourceFilesUnder(projectRoot, override)).length === 0) {
      throw new Error(`No TypeScript files under the server folder ${override}.`);
    }
    return override;
  }
  for (const folder of SERVER_FOLDERS) {
    if ((await sourceFilesUnder(projectRoot, folder)).length > 0) return folder;
  }
  return null;
}

/** The files `package.json` scripts run, such as `node server/main.ts`. */
async function scriptFiles(projectRoot: string): Promise<string[]> {
  const scripts = (await jsonObjectOf(projectRoot, 'package.json'))?.['scripts'];
  if (!isObject(scripts)) return [];
  return Object.values(scripts)
    .flatMap((command) => (typeof command === 'string' ? (command.match(SCRIPT_FILE) ?? []) : []))
    .map((file) => file.replace(LEADING_DOT_SLASH, ''));
}

/**
 * Finds what the project is made of: an Angular app (its whole source root from
 * `angular.json`, else `src/app`) as the browser, and the Node API (the first
 * of server/, backend/ or api/ that holds TypeScript, unless one is named) as
 * the server. A project with neither has no runtimes.
 */
export async function detectLayout(
  projectRoot: string,
  options: LayoutOptions = {},
): Promise<ProjectLayout> {
  const application = await angularApplication(projectRoot);
  const browserRoot = options.browserRoot ?? (await browserRootOf(projectRoot, application));
  const serverRoot = await serverRootOf(projectRoot, options.serverRoot);
  const runtimes: ArchitectureRuntime[] = [
    ...(browserRoot === null ? [] : [{ ...BROWSER, root: browserRoot }]),
    ...(serverRoot === null ? [] : [{ ...SERVER, root: serverRoot }]),
  ];
  const entryFiles = [
    ...(application ? [application.entry] : []),
    ...(await scriptFiles(projectRoot)),
  ];
  return { runtimes, entryFiles: [...new Set(entryFiles)].sort() };
}
