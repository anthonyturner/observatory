import { NewEntry, TranscriptEntry } from './transcript.types';

/** A transcript's entries in order, each numbered as it is added. An entry
 *  that changes later (a tool whose result arrives) is replaced in place. */
export class EntryList {
  private readonly entries: TranscriptEntry[] = [];
  private readonly positions = new Map<number, number>();
  private nextKey = 0;

  /** The key of the entry added last, or null when there is none. */
  get lastKey(): number | null {
    return this.entries.at(-1)?.key ?? null;
  }

  add(entry: NewEntry): number {
    const key = this.nextKey++;
    this.positions.set(key, this.entries.length);
    this.entries.push({ ...entry, key });
    return key;
  }

  replace(key: number, entry: NewEntry): void {
    const position = this.positions.get(key);
    if (position !== undefined) this.entries[position] = { ...entry, key };
  }

  /** The entries as they stand, in a list of their own. */
  snapshot(): readonly TranscriptEntry[] {
    return [...this.entries];
  }
}
