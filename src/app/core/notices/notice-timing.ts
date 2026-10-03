const BASE_MS = 10_000;
const PER_EXTRA_ROW_MS = 2_000;
const LONGEST_MS = 20_000;
/** Enough to read a line and reach for it after looking away. */
const SHORTEST_RESUME_MS = 4_000;

/** How long a notice of this many rows stands before it leaves on its own. */
export const noticeDurationMs = (rows: number): number =>
  Math.min(BASE_MS + PER_EXTRA_ROW_MS * Math.max(rows - 1, 0), LONGEST_MS);

/** The time a notice has once its countdown resumes. */
export const resumedMs = (remainingMs: number): number => Math.max(remainingMs, SHORTEST_RESUME_MS);
