import { constants } from 'node:fs';
import {
  appendFile,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  unlink,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** One entry of a folder. A link is neither a file nor a folder. */
export interface FolderEntry {
  readonly name: string;
  readonly isFile: boolean;
  readonly isFolder: boolean;
}

/** The disk as a pull request's worktree needs it; tests give their own. */
export interface WorktreeFiles {
  /** The text of `file`, or null when there is none. */
  read(file: string): Promise<string | null>;
  /** Adds `text` to the end of `file`, creating it and its folders. */
  append(file: string, text: string): Promise<void>;
  /** Whether anything is at `path`, a link included. */
  exists(path: string): Promise<boolean>;
  /** What is in `folder`; nothing when there is no such folder. */
  list(folder: string): Promise<readonly FolderEntry[]>;
  /** Copies `from` to `to`, unless `to` exists. */
  copy(from: string, to: string): Promise<void>;
  /**
   * Deletes `path` and all under it, however deep: a link is removed, never followed into.
   * Nothing about which paths are fit to delete is decided here.
   */
  removeTree(path: string): Promise<void>;
}

const isMissing = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';

/** Windows refuses a path past 260 characters unless it carries this prefix, and node_modules goes deeper. */
const LONG_PATH_PREFIX = '\\\\?\\';
const REMOVE_RETRIES = 4;
const REMOVE_RETRY_MS = 250;

export function nodeWorktreeFiles(platform: NodeJS.Platform = process.platform): WorktreeFiles {
  const pathFor = (path: string): string =>
    platform === 'win32' ? LONG_PATH_PREFIX + resolve(path) : path;
  return {
    async read(file) {
      try {
        return await readFile(file, 'utf8');
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async append(file, text) {
      await mkdir(dirname(file), { recursive: true });
      await appendFile(file, text);
    },
    async exists(path) {
      try {
        await lstat(path);
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    },
    async list(folder) {
      try {
        const entries = await readdir(folder, { withFileTypes: true });
        return entries.map((entry) => ({
          name: entry.name,
          isFile: entry.isFile(),
          isFolder: entry.isDirectory(),
        }));
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
    },
    async copy(from, to) {
      try {
        await copyFile(from, to, constants.COPYFILE_EXCL);
      } catch (error) {
        if ((error as NodeJS.ErrnoException | null)?.code !== 'EEXIST') throw error;
      }
    },
    async removeTree(path) {
      const target = pathFor(path);
      if ((await lstat(target).catch(() => null))?.isSymbolicLink()) return unlink(target);
      await rm(target, {
        recursive: true,
        force: true,
        maxRetries: REMOVE_RETRIES,
        retryDelay: REMOVE_RETRY_MS,
      });
    },
  };
}
