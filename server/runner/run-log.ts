/** What each line of a run's output says it is. */
export type RunEventKind =
  /** The run's state changed. */
  | 'state'
  /** One of Claude Code's own stream-json events. */
  | 'claude'
  /** A line of standard output that was not JSON. */
  | 'text'
  /** A line too long to keep: its head and size. */
  | 'cut'
  | 'stderr'
  /** Older events a follower asked for had been dropped to stay within keepBytes. */
  | 'trimmed';

/** One run event, as a line of NDJSON: `{ n, at, kind, data }`. */
export interface RunEvent {
  readonly n: number;
  readonly at: number;
  readonly kind: RunEventKind;
  readonly data: unknown;
}

/** Called with each event line, then with null once the log is closed. */
export type LogFollower = (line: string | null) => void;

interface KeptLine {
  readonly n: number;
  readonly line: string;
}

/** One run's output, numbered from 0, holding at most `keepBytes` of the newest. */
export class RunLog {
  private readonly kept: KeptLine[] = [];
  private readonly followers = new Set<LogFollower>();
  private keptBytes = 0;
  private nextNumber = 0;
  private isClosed = false;

  private readonly keepBytes: number;
  private readonly clock: () => number;

  constructor(keepBytes: number, clock: () => number) {
    this.keepBytes = keepBytes;
    this.clock = clock;
  }

  /** How many events have been written, trimmed ones included. */
  get count(): number {
    return this.nextNumber;
  }

  append(kind: RunEventKind, data: unknown): void {
    const event: RunEvent = { n: this.nextNumber++, at: this.clock(), kind, data };
    const line = JSON.stringify(event);
    this.kept.push({ n: event.n, line });
    this.keptBytes += line.length;
    this.trim();
    for (const follower of this.followers) follower(line);
  }

  /** Ends every follower; nothing more is written. */
  close(): void {
    this.isClosed = true;
    for (const follower of this.followers) follower(null);
    this.followers.clear();
  }

  /**
   * Calls `follower` with each event from number `from` on, then each new one,
   * then null once the log is closed. Returns the way to stop following.
   */
  follow(from: number, follower: LogFollower): () => void {
    this.replay(from, follower);
    if (this.isClosed) {
      follower(null);
      return () => undefined;
    }
    this.followers.add(follower);
    return () => this.followers.delete(follower);
  }

  private replay(from: number, follower: LogFollower): void {
    const first = this.kept[0]?.n ?? this.nextNumber;
    if (from < first) follower(this.trimmedNotice(first, from));
    for (const kept of this.kept) if (kept.n >= from) follower(kept.line);
  }

  private trimmedNotice(first: number, from: number): string {
    const notice: RunEvent = {
      n: first - 1,
      at: this.clock(),
      kind: 'trimmed',
      data: { dropped: first - from },
    };
    return JSON.stringify(notice);
  }

  /** The newest event always stays, however large. */
  private trim(): void {
    while (this.keptBytes > this.keepBytes && this.kept.length > 1) {
      this.keptBytes -= this.kept.shift()?.line.length ?? 0;
    }
  }
}
