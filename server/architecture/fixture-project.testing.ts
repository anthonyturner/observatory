import { commitAll, git, tempDir, write } from '../live-agents/testing/temp-repo.ts';

/** A project folder on disk, filled from a map of path to text. */
export function fixtureProject(files: Readonly<Record<string, string>>): string {
  const root = tempDir('arch');
  for (const [path, text] of Object.entries(files)) write(root, path, text);
  return root;
}

/** Makes the folder a git checkout. */
export function initGit(root: string): void {
  git(root, 'init', '--quiet', '--initial-branch=main');
}

/** Commits everything in `root` as of `date`, which git also reads as the commit's committer date. */
export function commitOn(root: string, message: string, date: string): void {
  const before = process.env['GIT_COMMITTER_DATE'];
  process.env['GIT_COMMITTER_DATE'] = date;
  try {
    commitAll(root, message);
  } finally {
    if (before === undefined) delete process.env['GIT_COMMITTER_DATE'];
    else process.env['GIT_COMMITTER_DATE'] = before;
  }
}

export { write };
