/** How a pull request's head now stands to the head it had earlier. */
export interface Comparison {
  /** GitHub's word: `ahead`, `behind`, `diverged` or `identical`. */
  readonly status: string;
  /** Commits on the later head that the earlier one does not have. */
  readonly aheadBy: number;
}

/** What GitHub's compare endpoint answers, as both readers ask for it. */
export const comparePath = (repo: string, base: string, head: string): string =>
  `repos/${repo}/compare/${base}...${head}`;

/** The two fields the queue reads from a compare answer; it throws on anything else. */
export function comparisonFrom(value: unknown): Comparison {
  const answer =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const { status, ahead_by: aheadBy } = answer;
  if (typeof status !== 'string' || typeof aheadBy !== 'number') {
    throw new Error('GitHub: a compare answer without a status and a count');
  }
  return { status, aheadBy };
}

/** Two commits of one repository side by side, for what changed since a pull request was looked at. */
export interface CompareReader {
  /** Throws when GitHub no longer has `base`, as after a force-push it has forgotten. */
  compare(repo: string, base: string, head: string): Promise<Comparison>;
  /** The unified diff from `base` to `head`. GitHub refuses one that is too large, and this throws. */
  compareDiff(repo: string, base: string, head: string): Promise<string>;
}
