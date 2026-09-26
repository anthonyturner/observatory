import { Injectable, signal } from '@angular/core';
import { AskedHow, EntryAction, EntrySaid, ReplyEntry, waitingEntry } from './reply-entry';
import { ReplyChip } from './reply-chip';

/** Replies kept in all, newest first. They last for this visit only, since a
 *  request can be private. */
export const REPLIES_KEPT = 20;

/** `entries` with `entry` on top, the oldest past the cap let go. */
export function withNewest(
  entries: readonly ReplyEntry[],
  entry: ReplyEntry,
): readonly ReplyEntry[] {
  return [entry, ...entries].slice(0, REPLIES_KEPT);
}

/** `entries` with the one numbered `id` changed; one let go stays gone. */
export function withChanged(
  entries: readonly ReplyEntry[],
  id: number,
  change: (entry: ReplyEntry) => ReplyEntry,
): readonly ReplyEntry[] {
  return entries.map((entry) => (entry.id === id ? change(entry) : entry));
}

/** The replies on Home, newest first. Each is changed in place by its id as
 *  its request is worked out. */
@Injectable({ providedIn: 'root' })
export class ReplyLog {
  private readonly list = signal<readonly ReplyEntry[]>([]);
  private lastId = 0;

  readonly entries = this.list.asReadonly();

  /** Starts a reply for `asked`, waiting on the router, and returns its id. */
  open(asked: string, how: AskedHow): number {
    this.lastId++;
    const entry = waitingEntry(this.lastId, asked, how);
    this.list.update((entries) => withNewest(entries, entry));
    return entry.id;
  }

  find(id: number): ReplyEntry | null {
    return this.list().find((entry) => entry.id === id) ?? null;
  }

  say(id: number, said: EntrySaid): void {
    this.change(id, (entry) => ({ ...entry, said }));
  }

  setChip(id: number, chip: ReplyChip): void {
    this.change(id, (entry) => ({ ...entry, chip }));
  }

  setActions(id: number, actions: readonly EntryAction[]): void {
    this.change(id, (entry) => ({ ...entry, actions }));
  }

  private change(id: number, change: (entry: ReplyEntry) => ReplyEntry): void {
    this.list.update((entries) => withChanged(entries, id, change));
  }
}
