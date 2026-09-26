import { createReadStream, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { windowOf } from './log-line.ts';
import { LogFold } from './log-fold.ts';
import type { LogSnapshot } from './log-types.ts';

/** A folder of log files, read line by line. */
export interface LogFolder {
  exists(dir: string): boolean;
  /** The `.log` files directly in `dir`. */
  files(dir: string): string[];
  lines(dir: string, file: string): AsyncIterable<string>;
}

export function fsLogFolder(): LogFolder {
  return {
    exists(dir) {
      try {
        return statSync(dir).isDirectory();
      } catch {
        return false;
      }
    },
    files: (dir) => readdirSync(dir).filter((file) => file.endsWith('.log')),
    lines: (dir, file) =>
      createInterface({ input: createReadStream(join(dir, file), 'utf8'), crlfDelay: Infinity }),
  };
}

/** Every log file in `dir`, folded into one snapshot stamped `now`. */
export async function readLogSnapshot(
  folder: LogFolder,
  dir: string,
  now: Date,
): Promise<LogSnapshot> {
  const files = folder.files(dir);
  const fold = new LogFold();
  for (const file of files) {
    const window = windowOf(file);
    fold.addWindow(window);
    for await (const line of folder.lines(dir, file)) fold.addLine(window, line);
  }
  return fold.snapshot({
    generatedAt: now.toISOString(),
    source: basename(dir),
    files: files.length,
  });
}
