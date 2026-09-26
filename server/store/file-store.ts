import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkedKey, type Store } from './store.ts';

/** Observatory's own folder on this machine. */
export const OBSERVATORY_DIR = join(homedir(), '.claude', 'observatory');

const fileOf = (root: string, key: string): string =>
  `${join(root, ...checkedKey(key).split('/'))}.json`;

/** One JSON file per key under `root`. A file that is missing or does not
 *  parse reads as none; a write lands whole or not at all. */
export function fileStore(root = OBSERVATORY_DIR): Store {
  return {
    async get(key) {
      const file = fileOf(root, key);
      try {
        return JSON.parse(readFileSync(file, 'utf8')) as unknown;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      const file = fileOf(root, key);
      mkdirSync(dirname(file), { recursive: true });
      const staged = `${file}.tmp`;
      writeFileSync(staged, JSON.stringify(value, null, 2), 'utf8');
      renameSync(staged, file);
    },
  };
}
