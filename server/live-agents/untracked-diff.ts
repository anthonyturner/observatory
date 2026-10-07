import { lstat, readFile, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import { mapWithLimit } from '../util/map-with-limit.ts';
import { ChangesFailure } from './git-facts.ts';
import { type NewFile, newFileDiff } from './new-file-diff.ts';
import type { Git } from './read-only-git.ts';

/** The untracked files' diffs, and the ones left out. */
export interface UntrackedDiff {
  readonly diff: string;
  readonly skippedLarge: readonly string[];
  readonly overCap: number;
}

/** A new file in a working folder is mostly source; a larger one is a build
 *  output or a dump nobody reads as a diff. */
export const UNTRACKED_FILE_LIMIT_BYTES = 256 * 1024;
/** Past this many, a folder holds an unignored build output, not an agent's new files. */
export const UNTRACKED_FILES_CAP = 200;
const READ_CONCURRENCY = 8;
const EXECUTABLE_BITS = 0o111;

export const DIFF_OPTIONS = [
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--src-prefix=a/',
  '--dst-prefix=b/',
];

/** The files git neither tracks nor ignores. A nested repository shows as a folder, and is left out. */
async function untrackedIn(git: Git, top: string): Promise<string[]> {
  const answer = await git(top, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (answer.code !== 0 || answer.isCut) throw new ChangesFailure('git-failed');
  return answer.stdout.split('\0').filter((path) => path !== '' && !path.endsWith('/'));
}

type Read = { readonly kind: 'file'; readonly file: NewFile } | { readonly kind: 'large' } | null;

/* Each file is read here rather than by one `git diff --no-index` apiece: a
   git process takes about 200 ms to start on Windows, so 200 new files would
   take most of a minute. new-file-diff.spec.ts holds the two outputs equal. */
async function readNew(top: string, path: string): Promise<Read> {
  const full = join(top, path);
  try {
    const stats = await lstat(full);
    if (stats.isSymbolicLink()) {
      return {
        kind: 'file',
        file: { path, content: Buffer.from(await readlink(full)), mode: '120000' },
      };
    }
    if (!stats.isFile()) return null;
    if (stats.size > UNTRACKED_FILE_LIMIT_BYTES) return { kind: 'large' };
    const mode = stats.mode & EXECUTABLE_BITS ? '100755' : '100644';
    return { kind: 'file', file: { path, content: await readFile(full), mode } };
  } catch {
    // Gone since git listed it, so it is no longer a change.
    return null;
  }
}

/** Each untracked file in `top` as a diff from nothing, up to the cap, leaving out large ones. */
export async function untrackedDiff(git: Git, top: string): Promise<UntrackedDiff> {
  const all = await untrackedIn(git, top);
  const listed = all.slice(0, UNTRACKED_FILES_CAP);
  const reads = await mapWithLimit(listed, READ_CONCURRENCY, (path) => readNew(top, path));
  return {
    diff: reads.map((read) => (read?.kind === 'file' ? newFileDiff(read.file) : '')).join(''),
    skippedLarge: listed.filter((_, index) => reads[index]?.kind === 'large'),
    overCap: all.length - listed.length,
  };
}
