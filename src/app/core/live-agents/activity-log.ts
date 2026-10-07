import { Transcript } from '../runs/transcript/transcript';
import { TranscriptEntry } from '../runs/transcript/transcript.types';
import { AgentFeedPage } from './agent-feed.types';

/** A session transcript names no run folder, which the run transcript only
 *  uses for a run's hooks and its start line; neither is in the feed. */
const NO_FOLDER = '';
/** The run transcript reads no time from Claude Code's own events. */
const NO_TIME = 0;

/** One agent's feed read so far, as transcript rows, and where to read from next. */
export class ActivityLog {
  private transcript = new Transcript(NO_FOLDER);
  private cursor: number | null = null;
  private count = 0;
  private hasPage = false;

  /** The byte offset to ask from next; null asks for a first load. */
  from(): number | null {
    return this.cursor;
  }

  /** Some page has been read, so there is a transcript to keep showing. */
  hasRead(): boolean {
    return this.hasPage;
  }

  take(page: AgentFeedPage): void {
    if (page.isRestart) this.transcript = new Transcript(NO_FOLDER);
    for (const data of page.events) {
      this.transcript.read({ n: this.count++, at: NO_TIME, kind: 'claude', data });
    }
    this.cursor = page.next;
    this.hasPage = true;
  }

  entries(): readonly TranscriptEntry[] {
    return this.transcript.entries();
  }
}
