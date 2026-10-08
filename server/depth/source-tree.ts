import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isMissingFile } from '../architecture/project-source.ts';
import type { Git } from '../live-agents/read-only-git.ts';

/** The files of one checkout, as the depth analysis reads them. */
export interface SourceTree {
  /** Every TypeScript file git knows of, by its path from the root with forward slashes. */
  files(): Promise<string[]>;
  /** A file's text; null when it is gone, as a file deleted since git listed it is. */
  read(path: string): Promise<string | null>;
}

const LIST_FILES = ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.ts'];

/**
 * A checkout read through git, so what is ignored there (installed packages,
 * build output, other worktrees) is not this repository's code here either.
 */
export function gitSourceTree(git: Git, root: string): SourceTree {
  return {
    async files() {
      const { code, stdout, stderr } = await git(root, LIST_FILES);
      if (code !== 0) throw new Error(`git could not list ${root}: ${stderr.trim()}`);
      return stdout.split('\0').filter(Boolean);
    },
    async read(path) {
      try {
        return await readFile(join(root, path), 'utf8');
      } catch (error) {
        if (isMissingFile(error)) return null;
        throw error;
      }
    },
  };
}
