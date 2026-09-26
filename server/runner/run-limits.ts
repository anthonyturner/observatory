/** Every limit on a tier-3 run (docs/decisions/0005-run-tier-3-tasks-on-the-local-site-only.md). */
export interface RunLimits {
  /** How long a proposal's token may wait to be used. */
  readonly proposalMs: number;
  /** A run is stopped when it has gone on this long. */
  readonly runMs: number;
  /** One run's output held in memory; the oldest events go first. */
  readonly keepBytes: number;
  /** A longer line (a tool result that read a whole large file) is kept as its head. */
  readonly lineBytes: number;
  /** How many finished runs the list keeps. */
  readonly recent: number;
  /** How many unused tokens may wait at once. */
  readonly offers: number;
  /** How long a run may outlive its own process with its output still open: a
   *  grandchild that escaped the kill can hold the pipe open for ever. */
  readonly closeMs: number;
  /** How long a kill has to work before it is tried again, and then given up on.
   *  A real cancel took under 2 s, hooks included. */
  readonly stopMs: number;
}

export const RUN_LIMITS: RunLimits = {
  proposalMs: 5 * 60_000,
  runMs: 30 * 60_000,
  keepBytes: 2 * 1024 * 1024,
  lineBytes: 256 * 1024,
  recent: 5,
  offers: 32,
  closeMs: 5_000,
  stopMs: 10_000,
};
