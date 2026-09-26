import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type Frame, MAX_FRAMES } from './frames.ts';

/** Where each repository's frames are kept. */
export interface HistoryStore {
  /** The newest MAX_FRAMES frames, oldest first. */
  read(repo: string): Frame[];
  append(repo: string, frame: Frame): void;
}

export const HISTORY_DIR = join(homedir(), '.claude', 'observatory', 'history');

/** `owner/name` as a file name: the name check already rules out anything else. */
const fileOf = (dir: string, repo: string): string => join(dir, `${repo.replace('/', '__')}.jsonl`);

function parseLines(text: string): Frame[] {
  const frames: Frame[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      frames.push(JSON.parse(line) as Frame);
    } catch {
      // A torn final line from an interrupted write; the rest still stands.
    }
  }
  return frames.sort((a, b) => a.at.localeCompare(b.at));
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
    read: (repo) => readAll(repo).slice(-MAX_FRAMES),
    append(repo, frame) {
      mkdirSync(dir, { recursive: true });
      const file = fileOf(dir, repo);
      appendFileSync(file, toLines([frame]), 'utf8');
      const frames = readAll(repo);
      if (frames.length >= MAX_FRAMES * 2) writeFileSync(file, toLines(frames.slice(-MAX_FRAMES)));
    },
  };
}
