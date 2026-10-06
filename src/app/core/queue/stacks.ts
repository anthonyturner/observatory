import { MergedBranch } from './ledger';
import { QueueItem } from './queue-report';

/** What stacking reads of an open pull request: its number and branches. */
export type StackPull = Pick<QueueItem, 'number' | 'branch' | 'base'>;

/** A pull request stacked on another open one: it merges into the other's head. */
export interface StackLink {
  readonly child: number;
  readonly parent: number;
}

/** The pull request a branch was stacked on, now merged, and the branch it merged into. */
export interface LandedBase {
  readonly number: number;
  readonly branch: string;
  readonly into: string;
}

/** Where one pull request sits in its stack. */
export interface StackNote {
  /** The open pull request it is stacked on, or null. */
  readonly parent: number | null;
  /** The open pull requests stacked on it. */
  readonly children: readonly number[];
  /** The merge of the base it was stacked on, once that has merged. */
  readonly landed: LandedBase | null;
}

/** Every open pull request and its stack; one in no stack has no note. */
export type Stacks = ReadonlyMap<number, StackNote>;

/**
 * Head branch → pull request, for heads only one open pull request has. A
 * fork's pull request from its own `main` into `main` heads nothing here.
 */
function headsOf(pulls: readonly StackPull[]): Map<string, number> {
  const heads = new Map<string, number>();
  const shared = new Set<string>();
  for (const pull of pulls) {
    if (!pull.branch || pull.branch === pull.base) continue;
    if (heads.has(pull.branch)) shared.add(pull.branch);
    heads.set(pull.branch, pull.number);
  }
  for (const branch of shared) heads.delete(branch);
  return heads;
}

/** Each pull request whose base is another open pull request's head, linked to it. */
export function stackLinks(pulls: readonly StackPull[]): StackLink[] {
  const heads = headsOf(pulls);
  return pulls.flatMap((pull) => {
    const parent = heads.get(pull.base);
    return parent !== undefined && parent !== pull.number ? [{ child: pull.number, parent }] : [];
  });
}

/**
 * Where `pull`'s base went: the merge that landed it, or null while another
 * open pull request still heads it. `merged` is newest first, so a reused
 * branch name means its latest merge.
 */
export function landedBaseOf(
  pull: StackPull,
  open: readonly StackPull[],
  merged: readonly MergedBranch[],
): LandedBase | null {
  if (!pull.base) return null;
  if (open.some((other) => other.number !== pull.number && other.branch === pull.base)) return null;
  const landed = merged.find((each) => each.head === pull.base);
  return landed ? { number: landed.number, branch: landed.head, into: landed.base } : null;
}

/** Every stacked pull request's place: what it is stacked on, what is stacked on it, and a merged base. */
export function stacksOf(pulls: readonly StackPull[], merged: readonly MergedBranch[]): Stacks {
  const links = stackLinks(pulls);
  const notes = new Map<number, StackNote>();
  for (const pull of pulls) {
    const parent = links.find((link) => link.child === pull.number)?.parent ?? null;
    const children = links.filter((link) => link.parent === pull.number).map((l) => l.child);
    const landed = landedBaseOf(pull, pulls, merged);
    if (parent !== null || children.length || landed) {
      notes.set(pull.number, { parent, children, landed });
    }
  }
  return notes;
}

/** Every link in `stacks`, child to parent. */
export const linksOf = (stacks: Stacks): StackLink[] =>
  [...stacks].flatMap(([child, note]) =>
    note.parent === null ? [] : [{ child, parent: note.parent }],
  );
