import { SpokenClip } from '../../../core/voice/voice-protocol';

/* When each line of one refresh is heard. The voice says one line at a time and
   a late line misleads, so a line that cannot start near its moment is not
   moved to some later one: it is dropped. */

/** A line, made, and the moment it should land. */
export interface ReadyLine {
  readonly clip: SpokenClip;
  /** When it should start, in wall seconds (`performance.now() / 1000`). */
  readonly at: number;
  /** How long after `at` it may still start, in seconds. */
  readonly lateS: number;
}

/** A line placed on the wall clock. */
export interface Play extends ReadyLine {
  /** When it will start: `at`, or the end of the line before it. */
  readonly startAt: number;
}

/** The breath left after a line, so the next does not start as it is still ending. */
export const GAP_S = 0.3;

export const lengthOf = ({ audio, rate }: SpokenClip): number => audio.length / rate;

/**
 * Places `lines` in the order given, one after another: each starts at its own
 * moment, or when the one before it is done if that is later. Any that would
 * start past its tolerance, or already has, is dropped and takes no room.
 * `freeAt` is when the voice is next free, from the lines placed before;
 * `now` is the earliest anything can start.
 */
export function placeLines(
  lines: readonly ReadyLine[],
  freeAt: number,
  now: number,
): { readonly plays: Play[]; readonly freeAt: number } {
  const plays: Play[] = [];
  let free = freeAt;
  for (const line of lines) {
    const startAt = Math.max(line.at, free, now);
    if (startAt - line.at > line.lateS) continue;
    plays.push({ ...line, startAt });
    free = startAt + lengthOf(line.clip) + GAP_S;
  }
  return { plays, freeAt: free };
}
