import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** The default 1 MB buffer overflows on a busy repository; the file names of 90 days run to a few megabytes. */
const MAX_LOG_BYTES = 64 * 1024 * 1024;
/** What `--format=%x01` writes before each commit's file names, so one commit's files can be told apart. */
const COMMIT_MARK = '\u0001';

/** How often each file changed in the window before HEAD, and how many days that window was. */
export interface Churn {
  /** 0 when there is no history to count. */
  readonly days: number;
  readonly commitsByFile: ReadonlyMap<string, number>;
}

const NO_HISTORY: Churn = { days: 0, commitsByFile: new Map() };

const git = async (root: string, args: readonly string[]): Promise<string> =>
  (
    await run('git', ['-C', root, '-c', 'core.quotepath=off', ...args], {
      maxBuffer: MAX_LOG_BYTES,
    })
  ).stdout;

/** The commits' file lists in a `git log --name-only` whose commits start with COMMIT_MARK. */
function countFiles(log: string): Map<string, number> {
  const commits = new Map<string, number>();
  for (const commit of log.split(COMMIT_MARK)) {
    const files = new Set(commit.split('\n').filter((line) => line.trim() !== ''));
    for (const file of files) commits.set(file, (commits.get(file) ?? 0) + 1);
  }
  return commits;
}

/**
 * Counts the commits that touched each file in the `days` before the date of
 * HEAD. Counting back from HEAD's date rather than from now keeps two scans of
 * an unchanged repository the same. A folder that is not a git checkout, or
 * whose checkout has no commit yet, has no history to count, which is an
 * ordinary state and not an error, so it gets no churn at all.
 */
export async function gitChurn(root: string, days: number): Promise<Churn> {
  let head: string;
  try {
    head = (await git(root, ['log', '-1', '--format=%cI'])).trim();
  } catch {
    return NO_HISTORY;
  }
  const since = new Date(new Date(head).getTime() - days * MS_PER_DAY).toISOString();
  const log = await git(root, [
    'log',
    `--since=${since}`,
    '--format=%x01',
    '--name-only',
    '--no-renames',
    '--relative',
    '--',
    '.',
  ]);
  return { days, commitsByFile: countFiles(log) };
}
