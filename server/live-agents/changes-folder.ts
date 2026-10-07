import { blocksOf, isBlock, parseLine, text } from './transcript-lines.ts';

/** A folder a transcript says its agent worked in, and the branch it was on there. */
export interface WorkPlace {
  readonly cwd: string;
  /** Null when the transcript does not say, and git is left to. */
  readonly branch: string | null;
}

/** The working tree a path is in, or null; a test gives its own. */
export type RootOf = (path: string) => string | null;

/** Branches every checkout shares. Work on them is not one agent's, so a later
 *  step back onto one does not hide the feature branch the agent worked on. */
const SHARED_BRANCHES: ReadonlySet<string> = new Set(['main', 'master', 'HEAD']);
/** The tools that write a file, and the input naming it. */
const FILE_INPUTS = ['file_path', 'notebook_path'];
const WRITING_TOOLS: ReadonlySet<string> = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

const isFeatureBranch = (branch: string | null): boolean =>
  branch !== null && !SHARED_BRANCHES.has(branch);

/** The files a reply's tool calls wrote, in order. */
function writtenPaths(content: unknown): string[] {
  return blocksOf(content).flatMap((block) => {
    if (block['type'] !== 'tool_use' || !WRITING_TOOLS.has(String(block['name']))) return [];
    const input = isBlock(block['input']) ? block['input'] : {};
    const path = FILE_INPUTS.map((key) => text(input[key])).find((value) => value !== null);
    return path ? [path] : [];
  });
}

interface Trail {
  readonly latest: WorkPlace | null;
  readonly latestOnFeature: WorkPlace | null;
  readonly lastWritten: string | null;
}

function trailOf(lines: readonly string[]): Trail {
  let latest: WorkPlace | null = null;
  let latestOnFeature: WorkPlace | null = null;
  let lastWritten: string | null = null;
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    lastWritten = writtenPaths(parsed.message?.content).at(-1) ?? lastWritten;
    const cwd = text(parsed.cwd);
    if (!cwd) continue;
    latest = { cwd, branch: text(parsed.gitBranch) };
    if (isFeatureBranch(latest.branch)) latestOnFeature = latest;
  }
  return { latest, latestOnFeature, lastWritten };
}

/**
 * Where an agent's changes are, from its transcript's last lines in order: the
 * latest folder it worked in on a feature branch; else the worktree holding
 * the file it last wrote, when that is not the folder it stands in, since a
 * subagent edits a worktree by its full path without ever moving there; else
 * the latest folder of all. Null when no line names a folder.
 */
export function workPlaceOf(lines: readonly string[], rootOf: RootOf): WorkPlace | null {
  const { latest, latestOnFeature, lastWritten } = trailOf(lines);
  if (latestOnFeature || !latest) return latestOnFeature;
  const writtenRoot = lastWritten ? rootOf(lastWritten) : null;
  return writtenRoot && writtenRoot !== rootOf(latest.cwd)
    ? { cwd: writtenRoot, branch: null }
    : latest;
}
