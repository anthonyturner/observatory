import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { portFlagFor } from './dev-port.ts';

/** What to run in a project's checkout, and optionally where its site then is. */
export interface RunCommand {
  /** One shell line: `npm run dev`, or the owner's own from run.json. A `{port}` in it
   *  stands for the port Observatory chooses. */
  readonly command: string;
  /** The owner's address for the site, which wins over the one the server prints. */
  readonly url: string | null;
}

/** How a project is run in a checkout. */
export interface RunCommands {
  /** The command for `repo`'s checkout at `folder`, or null when there is none to run. */
  commandFor(repo: string, folder: string): RunCommand | null;
}

export const RUN_FILE = join(homedir(), '.claude', 'observatory', 'run.json');
/** The package scripts that start a dev server, in the order they are preferred. */
const SCRIPTS: readonly { readonly script: string; readonly command: string }[] = [
  { script: 'dev', command: 'npm run dev' },
  { script: 'start', command: 'npm start' },
];
const WEB_ADDRESS = /^https?:\/\//i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The JSON in `file`, or undefined when it is missing or not JSON. */
export type ReadJson = (file: string) => unknown;

const readJsonFile: ReadJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

/** One run.json entry, or null when it names no command. A url that is not http(s) is dropped, not trusted. */
function overrideFrom(entry: unknown): RunCommand | null {
  if (!isObject(entry) || typeof entry['command'] !== 'string' || !entry['command'].trim()) {
    return null;
  }
  const url = entry['url'];
  return {
    command: entry['command'].trim(),
    url: typeof url === 'string' && WEB_ADDRESS.test(url) ? url : null,
  };
}

function scriptsOf(packageJson: unknown): Readonly<Record<string, unknown>> {
  return isObject(packageJson) && isObject(packageJson['scripts']) ? packageJson['scripts'] : {};
}

/**
 * Run commands from the owner's run.json (`{"owner/repo": {"command", "url"}}`),
 * else the checkout's `dev` script, else its `start` script. Both files are read
 * afresh on each call, so an edit takes effect on the next Run.
 */
export function fileRunCommands(
  overridesFile = RUN_FILE,
  readJson: ReadJson = readJsonFile,
): RunCommands {
  return {
    commandFor(repo, folder) {
      const overrides = readJson(overridesFile);
      const key = repo.toLowerCase();
      const listed = isObject(overrides)
        ? Object.entries(overrides).find(([name]) => name.toLowerCase() === key)
        : undefined;
      const override = listed && overrideFrom(listed[1]);
      if (override) return override;
      const scripts = scriptsOf(readJson(join(folder, 'package.json')));
      for (const { script, command } of SCRIPTS) {
        const body = scripts[script];
        if (typeof body === 'string') return { command: command + portFlagFor(body), url: null };
      }
      return null;
    },
  };
}
