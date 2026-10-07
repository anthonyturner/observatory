import { parseLine, text } from './transcript-lines.ts';

/** A folder a transcript says its agent worked in, and the branch it was on there. */
export interface WorkPlace {
  readonly cwd: string;
  readonly branch: string | null;
}

/** Branches every checkout shares. Work on them is not one agent's, so a later
 *  step back onto one does not hide the feature branch the agent worked on. */
const SHARED_BRANCHES: ReadonlySet<string> = new Set(['main', 'master', 'HEAD']);

const isFeatureBranch = (branch: string | null): boolean =>
  branch !== null && !SHARED_BRANCHES.has(branch);

/**
 * Where an agent's changes are, from its transcript's last lines in order: the
 * latest folder it worked in on a feature branch, else the latest folder of
 * all; null when no line names one. A session's folder moves as it works.
 */
export function workPlaceOf(lines: readonly string[]): WorkPlace | null {
  let latest: WorkPlace | null = null;
  let latestOnFeature: WorkPlace | null = null;
  for (const line of lines) {
    const parsed = parseLine(line);
    const cwd = parsed && text(parsed.cwd);
    if (!parsed || !cwd) continue;
    latest = { cwd, branch: text(parsed.gitBranch) };
    if (isFeatureBranch(latest.branch)) latestOnFeature = latest;
  }
  return latestOnFeature ?? latest;
}
