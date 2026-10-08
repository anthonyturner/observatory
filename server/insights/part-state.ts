import type { PartState } from './insights-types.ts';

/** The report's parts, each read on its own so one that fails leaves the rest. */
export type InsightsPart = 'commits' | 'contributors' | 'pulls' | 'traffic';

const PART_WORDS: Readonly<Record<InsightsPart, string>> = {
  commits: 'commit activity',
  contributors: 'contributors',
  pulls: 'pull requests',
  traffic: 'traffic',
};

export const READ: PartState = { status: 'read', note: null };

/** Both `gh api` and the REST client put GitHub's status in the error. */
const DENIED = /HTTP (?:401|403|404)\b/;

/** GitHub's REST docs: traffic needs push access, or a fine-grained token's "Administration: read". */
const NO_TRAFFIC_ACCESS =
  'Traffic needs push access to the repository, which this token does not have.';

export const WITHHELD_TRAFFIC: PartState = {
  status: 'withheld',
  note: 'Traffic is shown only to the owner.',
};

export const countingState = (part: InsightsPart): PartState => ({
  status: 'counting',
  note: `GitHub is still counting the ${PART_WORDS[part]}. Check again in a minute.`,
});

/** The plain note for a part GitHub would not give. */
export function failureState(part: InsightsPart, error: unknown): PartState {
  const message = error instanceof Error ? error.message : String(error);
  if (part === 'traffic' && DENIED.test(message)) {
    return { status: 'no-access', note: NO_TRAFFIC_ACCESS };
  }
  return {
    status: 'failed',
    note: `GitHub did not answer for ${PART_WORDS[part]}. Try again in a moment.`,
  };
}
