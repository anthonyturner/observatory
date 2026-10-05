/** How long the pointer rests on a star before its card opens. */
export const HOVER_DWELL_MS = 150;

/**
 * Settles on what the pointer rests over once it has stayed put a moment, so a
 * sweep across the sky does not flicker through cards. Each thing settles once
 * per visit: resting on it again needs the pointer to leave it first.
 */
export class HoverDwell<T> {
  private aimed: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly settle: (value: T) => void,
    private readonly ms = HOVER_DWELL_MS,
  ) {}

  /** The pointer is over `value`, known by `key`, or over nothing (null). */
  aim(key: string | null, value: T | null): void {
    if (key === this.aimed) return;
    this.cancel();
    this.aimed = key;
    if (key !== null && value !== null) {
      this.timer = setTimeout(() => this.settle(value), this.ms);
    }
  }

  /** Drops a rest still waiting to settle. */
  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
