import { Injectable, signal } from '@angular/core';
import { hashString } from '../orrery/world-layout';
import { DiffFile } from './diff-files';

const STORAGE_KEY = 'observatory.diff-viewed';
/** Diffs remembered; past this the one ticked longest ago is forgotten first. */
const MAX_DIFFS = 200;

/** A file of a diff as it was seen: a tick holds only while the text is the same. */
export interface SeenFile {
  readonly path: string;
  readonly fingerprint: string;
}

/** Each diff's ticked files, path to fingerprint, the most recently ticked diff last. */
type Marks = ReadonlyMap<string, ReadonlyMap<string, string>>;

interface StoredDiff {
  readonly diff: string;
  readonly files: Readonly<Record<string, string>>;
}

/** Names a pull request's whole diff. */
export const pullDiffKey = (repo: string, number: number): string => `${repo}#${number}`;

/** Names one commit's diff within its pull request. */
export const commitDiffKey = (repo: string, number: number, sha: string): string =>
  `${pullDiffKey(repo, number)}@${sha}`;

export function seenFileOf(file: DiffFile): SeenFile {
  const text = file.lines.join('\n');
  return { path: file.path, fingerprint: `${text.length}:${hashString(text)}` };
}

/** The files of each diff ticked as viewed on this browser. Kept in local
 *  storage only; where storage is blocked the ticks last for this visit. */
@Injectable({ providedIn: 'root' })
export class ViewedFiles {
  private readonly marks = signal<Marks>(readStored());

  /** False once the file's text has changed since it was ticked. */
  isViewed(diff: string, file: SeenFile): boolean {
    return this.marks().get(diff)?.get(file.path) === file.fingerprint;
  }

  mark(diff: string, file: SeenFile): void {
    const files = new Map(this.marks().get(diff)).set(file.path, file.fingerprint);
    this.save(withFiles(this.marks(), diff, files));
  }

  unmark(diff: string, path: string): void {
    const files = new Map(this.marks().get(diff));
    files.delete(path);
    this.save(withFiles(this.marks(), diff, files));
  }

  private save(marks: Marks): void {
    this.marks.set(marks);
    store(marks);
  }
}

/** Moves the diff to the most recent end, drops it once empty, and forgets the oldest past the cap. */
function withFiles(marks: Marks, diff: string, files: ReadonlyMap<string, string>): Marks {
  const entries = [...marks].filter(([key]) => key !== diff);
  if (files.size > 0) entries.push([diff, files]);
  return new Map(entries.slice(-MAX_DIFFS));
}

const isFingerprints = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((each) => typeof each === 'string');

const isStoredDiff = (value: unknown): value is StoredDiff =>
  typeof value === 'object' &&
  value !== null &&
  'diff' in value &&
  typeof value.diff === 'string' &&
  'files' in value &&
  isFingerprints(value.files);

/** Storage is outside the program: anything that is not a list of diffs is dropped. */
function readStored(): Marks {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const diffs = Array.isArray(parsed) ? parsed.filter(isStoredDiff) : [];
    return new Map(diffs.map(({ diff, files }) => [diff, new Map(Object.entries(files))]));
  } catch {
    return new Map();
  }
}

function store(marks: Marks): void {
  const diffs: StoredDiff[] = [...marks].map(([diff, files]) => ({
    diff,
    files: Object.fromEntries(files),
  }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diffs));
  } catch {
    return;
  }
}
