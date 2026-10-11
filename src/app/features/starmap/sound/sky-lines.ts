import { hashString } from '../../../core/orrery/world-layout';
import { ExitKind } from '../memory/exits';

/* What Jev says as the sky changes. Every line is fixed, so each can be made
   once and kept (see LineClips): nothing here names a pull request or an issue. */

export const RESOLVED_LINE = 'Resolved!';

const ONE_ENDED: Readonly<Record<ExitKind, string>> = {
  merged: 'Merged!',
  squashed: 'Squashed and shipped!',
  closed: 'Closed. Into the dark it goes.',
};

const SEVERAL_ENDED: Readonly<Record<ExitKind, (count: string) => string>> = {
  merged: (count) => `${count} merged!`,
  squashed: (count) => `${count} squashed and shipped!`,
  closed: (count) => `${count} closed. Into the dark they go.`,
};

const COUNT_WORDS = ['One', 'Two', 'Three', 'Four', 'Five'];
const countWord = (count: number): string => COUNT_WORDS[count - 1] ?? 'Many';

/**
 * The one line for everything that ended in a refresh: its own for a single
 * ending, the count for several of one kind ("Three merged!"), and just the
 * count when they differ ("Three left the sky!"). Null when nothing ended.
 */
export function endingLine(kinds: readonly ExitKind[]): string | null {
  const [first] = kinds;
  if (first === undefined) return null;
  if (kinds.length === 1) return ONE_ENDED[first];
  if (kinds.every((kind) => kind === first)) {
    return SEVERAL_ENDED[first](countWord(kinds.length));
  }
  return `${countWord(kinds.length)} left the sky!`;
}

export const FAREWELLS: readonly string[] = [
  'Goodbye!',
  'To the lull!',
  'Back to port, captain!',
  'Off to the dock!',
  'See you in orbit!',
];

/** A ship's or satellite's farewell, always the same one for the same key. */
export const farewellFor = (key: string): string => FAREWELLS[hashString(key) % FAREWELLS.length];

/** The lines worth making ahead, so the first one that is needed is ready. */
export const PREPARED_LINES: readonly string[] = [
  RESOLVED_LINE,
  ...Object.values(ONE_ENDED),
  ...FAREWELLS,
];
