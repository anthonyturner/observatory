import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OBSERVATORY_DIR } from '../store/file-store.ts';
import { repoKey, type Store } from '../store/store.ts';
import { type Frame, MAX_FRAMES } from './frames.ts';

/** Where each repository's frames are kept. */
export interface HistoryStore {
  /** The newest MAX_FRAMES frames, oldest first. */
  read(repo: string): Promise<Frame[]>;
  append(repo: string, frame: Frame): Promise<void>;
}

export const HISTORY_DIR = join(OBSERVATORY_DIR, 'history');

const byTime = (a: Frame, b: Frame): number => a.at.localeCompare(b.at);

/** Whether a stored value is shaped like a frame, as far as reading one needs. */
const isFrame = (value: unknown): value is Frame => {
  if (typeof value !== 'object' || value === null) return false;
  const frame = value as Record<string, unknown>;
  return (
    typeof frame['at'] === 'string' &&
    Array.isArray(frame['items']) &&
    Array.isArray(frame['departed'])
  );
};

/** `owner/name` as a file name: the name check already rules out anything else. */
const fileOf = (dir: string, repo: string): string => join(dir, `${repoKey(repo)}.jsonl`);

function parseLines(text: string): Frame[] {
  const frames: Frame[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const frame: unknown = JSON.parse(line);
      if (isFrame(frame)) frames.push(frame);
    } catch {
      // A torn final line from an interrupted write; the rest still stands.
    }
  }
  return frames.sort(byTime);
}

const toLines = (frames: readonly Frame[]): string =>
  frames.map((frame) => `${JSON.stringify(frame)}\n`).join('');

/** Frames as JSON lines, one file per repository. Appending is cheap; once the
 *  file holds twice the cap it is rewritten with the newest MAX_FRAMES. */
export function fileHistoryStore(dir = HISTORY_DIR): HistoryStore {
  const readAll = (repo: string): Frame[] => {
    try {
      return parseLines(readFileSync(fileOf(dir, repo), 'utf8'));
    } catch {
      return [];
    }
  };
  return {
    read: async (repo) => readAll(repo).slice(-MAX_FRAMES),
    async append(repo, frame) {
      mkdirSync(dir, { recursive: true });
      const file = fileOf(dir, repo);
      appendFileSync(file, toLines([frame]), 'utf8');
      const frames = readAll(repo);
      if (frames.length >= MAX_FRAMES * 2) writeFileSync(file, toLines(frames.slice(-MAX_FRAMES)));
    },
  };
}

/** Stored frames, oldest first, leaving out anything that is not one. */
export function framesFrom(value: unknown): Frame[] {
  const frames = (value as { frames?: unknown } | null)?.frames;
  return Array.isArray(frames) ? frames.filter(isFrame).sort(byTime) : [];
}

/** Frames as one document per repository, the newest MAX_FRAMES only: for a
 *  store with no cheap append, such as the hosted site's Redis. */
export function storeHistoryStore(store: Store): HistoryStore {
  const keyOf = (repo: string): string => `history/${repoKey(repo)}`;
  const read = async (repo: string): Promise<Frame[]> =>
    framesFrom(await store.get(keyOf(repo))).slice(-MAX_FRAMES);
  return {
    read,
    async append(repo, frame) {
      const frames = [...(await read(repo)), frame].sort(byTime).slice(-MAX_FRAMES);
      await store.set(keyOf(repo), { frames });
    },
  };
}
