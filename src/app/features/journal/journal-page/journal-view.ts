import { JournalEntry } from '../../../core/journal/journal-report';
import { Principle } from '../../../core/principles/principle.types';
import { dateWords } from '../../releases/release-words';

/** A principle some entry taught, as a filter chip. */
export interface PrincipleChip {
  readonly id: string;
  /** The principle's title; its id where the deck is not read or no longer holds it. */
  readonly label: string;
  /** How many entries taught it. */
  readonly count: number;
}

/** One entry, ready to draw. */
export interface JournalCard {
  readonly key: string;
  readonly pull: number;
  readonly url: string;
  readonly date: string;
  readonly firstVersion: string;
  readonly feedback: string;
  readonly change: string;
  readonly principles: readonly { readonly id: string; readonly label: string }[];
}

/** Principles by id, for labelling; empty while the deck is not read. */
export type PrincipleTitles = ReadonlyMap<string, Principle>;

const labelOf = (titles: PrincipleTitles, id: string): string => titles.get(id)?.title ?? id;

/** The principles the entries taught, the most taught first and then by label. */
export function chipsOf(
  entries: readonly JournalEntry[],
  titles: PrincipleTitles,
): PrincipleChip[] {
  const counts = new Map<string, number>();
  for (const id of entries.flatMap((entry) => entry.principles)) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts]
    .map(([id, count]): PrincipleChip => ({ id, label: labelOf(titles, id), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** The entries that taught `picked`, or all of them when nothing is picked, as cards in the same order. */
export function cardsOf(
  entries: readonly JournalEntry[],
  titles: PrincipleTitles,
  picked: string | null,
): JournalCard[] {
  return entries
    .filter((entry) => picked === null || entry.principles.includes(picked))
    .map((entry, place): JournalCard => ({
      key: `${entry.url}:${place}`,
      pull: entry.pull,
      url: entry.url,
      date: dateWords(entry.postedAt),
      firstVersion: entry.firstVersion,
      feedback: entry.feedback,
      change: entry.change,
      principles: entry.principles.map((id) => ({ id, label: labelOf(titles, id) })),
    }));
}
