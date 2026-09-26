import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * The fixed flags every run gets. There is no permission flag on purpose: a
 * run keeps the owner's own allow rules and hooks, and `-p` refuses a tool
 * they do not allow, since it cannot ask.
 */
export const CLAUDE_ARGS: readonly string[] = ['-p', '--output-format', 'stream-json', '--verbose'];

/** The command as a proposal shows it. */
export const RUN_COMMAND = `claude ${CLAUDE_ARGS.join(' ')}`;

/** Claude Code's executable, and whether it is a batch shim only cmd.exe can start. */
export interface ClaudeCommand {
  readonly file: string;
  readonly isShim: boolean;
}

/** What finding `claude` looks at; tests give their own. */
export interface PathSearch {
  readonly env: NodeJS.ProcessEnv;
  readonly platform: NodeJS.Platform;
  readonly exists: (file: string) => boolean;
}

const WINDOWS_NAMES = ['claude.exe', 'claude.cmd', 'claude.bat'];
const OTHER_NAMES = ['claude'];
const SHIM = /\.(cmd|bat)$/i;

const pathOf = (env: NodeJS.ProcessEnv): string => {
  const key = Object.keys(env).find((name) => name.toUpperCase() === 'PATH');
  return key ? (env[key] ?? '') : '';
};

/** `claude` on the PATH, or null. On Windows only a real executable or a batch
 *  shim counts: npm also writes an extensionless shell script there, which
 *  Windows cannot start. */
export function findClaude(
  search: PathSearch = { env: process.env, platform: process.platform, exists: existsSync },
): ClaudeCommand | null {
  const names = search.platform === 'win32' ? WINDOWS_NAMES : OTHER_NAMES;
  for (const dir of pathOf(search.env).split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const file = join(dir, name);
      if (search.exists(file)) return { file, isShim: SHIM.test(name) };
    }
  }
  return null;
}
