import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Enough for any list or diff `gh` returns here; its default is 1 MB. */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/** Runs `gh` with `args`, never through a shell, and answers its output. */
export async function gh(args: readonly string[]): Promise<string> {
  const { stdout } = await run('gh', [...args], { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES });
  return stdout;
}

export const ghJson = async <T>(args: readonly string[]): Promise<T> =>
  JSON.parse(await gh(args)) as T;
