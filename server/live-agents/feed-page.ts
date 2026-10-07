import { sizeOf } from '../queue/pull-size.ts';
import { feedEventOf } from './feed-events.ts';
import type { AgentFeedPage, FeedEvent } from './feed-types.ts';
import { parseLine } from './transcript-lines.ts';
import { lastLines, lineSpansFrom } from './transcript-window.ts';

/** The most one answer carries, serialized: the tab asks again for the rest. */
export const FEED_LIMIT_BYTES = 256 * 1024;
/** A first load shows the agent's latest events, not its whole history. */
export const FIRST_LOAD_EVENTS = 200;
/** Real transcript lines reach 1.2 MB, so one read takes in a few of the largest. */
export const FEED_READ_BYTES = 4 * 1024 * 1024;

/** What the answer's own fields take, at their largest, out of the cap. */
const ENVELOPE_BYTES = sizeOf({ events: [], next: Number.MAX_SAFE_INTEGER, isRestart: false });
/** Each event after the first adds a comma to the list. */
const SEPARATOR_BYTES = 1;

const eventIn = (line: string): FeedEvent | null => {
  const parsed = parseLine(line);
  return parsed ? feedEventOf(parsed) : null;
};

/** The longest run of `events`' newest that fits under `limit` bytes. */
function newestThatFit(events: readonly FeedEvent[], limit: number): FeedEvent[] {
  const kept: FeedEvent[] = [];
  let bytes = ENVELOPE_BYTES;
  for (let index = events.length - 1; index >= 0; index--) {
    bytes += sizeOf(events[index]) + SEPARATOR_BYTES;
    if (bytes > limit) break;
    kept.unshift(events[index]);
  }
  return kept;
}

/** The agent's latest events, from the end of `file`. */
export async function firstPage(file: string, limit = FEED_LIMIT_BYTES): Promise<AgentFeedPage> {
  const window = await lastLines(file, FEED_READ_BYTES);
  if (!window) return { events: [], next: null, isRestart: true };
  const events = window.lines.flatMap((line) => eventIn(line) ?? []);
  return {
    events: newestThatFit(events.slice(-FIRST_LOAD_EVENTS), limit),
    next: window.next,
    isRestart: true,
  };
}

/**
 * The events written to `file` since byte `from`, oldest first, as many as fit
 * under `limit`. `next` is just past the last line used, so a read cut short
 * by the cap carries on from there rather than skipping what did not fit.
 */
export async function pageFrom(
  file: string,
  from: number,
  limit = FEED_LIMIT_BYTES,
): Promise<AgentFeedPage> {
  const spans = await lineSpansFrom(file, from, FEED_READ_BYTES);
  if (!spans) return firstPage(file, limit);
  const events: FeedEvent[] = [];
  let bytes = ENVELOPE_BYTES;
  let next = from;
  for (const line of spans.lines) {
    const event = eventIn(line.text);
    if (event) {
      bytes += sizeOf(event) + SEPARATOR_BYTES;
      if (bytes > limit && events.length > 0) return { events, next, isRestart: false };
      events.push(event);
    }
    next = line.end;
  }
  return { events, next: spans.next, isRestart: false };
}
