import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** What a file gave when last read, and the key that says whether it has changed since. */
export interface FileEntry<T> {
  readonly key: string;
  readonly value: T;
}

export type FileEntries<T> = Readonly<Record<string, FileEntry<T>>>;

/** Where the entries are kept between reports; a test keeps them in memory. */
export interface EntryStore<T> {
  read(): Promise<FileEntries<T>>;
  write(entries: FileEntries<T>): Promise<void>;
}

/** A file's size and modification time, or null for a file that cannot be read. */
export async function fileKey(path: string): Promise<string | null> {
  try {
    const stats = await stat(path);
    return `${stats.size}-${Math.floor(stats.mtimeMs)}`;
  } catch {
    return null;
  }
}

/** The files last modified at or after `from`: older ones hold nothing newer. */
export async function changedSince(files: readonly string[], from: number): Promise<string[]> {
  const kept: string[] = [];
  for (const file of files) {
    try {
      if ((await stat(file)).mtimeMs >= from) kept.push(file);
    } catch {
      // Gone since it was listed: nothing to read.
    }
  }
  return kept;
}

/** Each file's value, read again only when its key has changed. Files not
 *  listed are dropped from the store, so it never outgrows the logs it covers. */
export async function valuesPerFile<T>(
  files: readonly string[],
  store: EntryStore<T>,
  keyOf: (file: string) => Promise<string | null>,
  readValue: (file: string) => Promise<T>,
): Promise<Map<string, T>> {
  const kept = await store.read();
  const next: Record<string, FileEntry<T>> = {};
  for (const file of files) {
    const key = await keyOf(file);
    if (key === null) continue;
    next[file] = kept[file]?.key === key ? kept[file] : { key, value: await readValue(file) };
  }
  await store.write(next);
  return new Map(Object.entries(next).map(([file, entry]) => [file, entry.value]));
}

/** The entries as one JSON file. A version bump, or a file that will not parse,
 *  starts afresh rather than trusting what it held. */
export function jsonEntryStore<T>(path: string, version: number): EntryStore<T> {
  return {
    async read() {
      try {
        const saved = JSON.parse(await readFile(path, 'utf8')) as {
          version?: number;
          entries?: FileEntries<T>;
        };
        return saved.version === version && saved.entries ? saved.entries : {};
      } catch {
        return {};
      }
    },
    async write(entries) {
      await mkdir(dirname(path), { recursive: true });
      // Compact: pretty-printed, a month of logs' cache runs to megabytes.
      await writeFile(path, JSON.stringify({ version, entries }), 'utf8');
    },
  };
}
