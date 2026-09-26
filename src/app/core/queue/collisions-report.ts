/** Whether the pairs were merged in a local clone, and if not, why. */
export type CollisionCheck = 'checked' | 'no-clone' | 'unreachable';

/** Two open pull requests that change a file in common. */
export interface Collision {
  readonly a: number;
  readonly b: number;
  readonly files: readonly string[];
  /** The files that would conflict, `[]` when they merge cleanly, or null when unchecked. */
  readonly conflicts: readonly string[] | null;
}

/** What `GET /api/collisions` returns. */
export interface CollisionsReport {
  readonly repo: string;
  readonly check: CollisionCheck;
  readonly pairs: readonly Collision[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];
const CHECKS: readonly unknown[] = ['checked', 'no-clone', 'unreachable'];

function parsePair(value: unknown): Collision | null {
  if (!isObject(value) || !isNumber(value['a']) || !isNumber(value['b'])) return null;
  const conflicts = value['conflicts'];
  return {
    a: value['a'],
    b: value['b'],
    files: strings(value['files']),
    // Anything but a list of files reads as unchecked: never as safe.
    conflicts: Array.isArray(conflicts) ? strings(conflicts) : null,
  };
}

export function parseCollisions(value: unknown): CollisionsReport | null {
  if (!isObject(value) || typeof value['repo'] !== 'string') return null;
  if (!CHECKS.includes(value['check']) || !Array.isArray(value['pairs'])) return null;
  return {
    repo: value['repo'],
    check: value['check'] as CollisionCheck,
    pairs: value['pairs'].map(parsePair).filter((pair): pair is Collision => pair !== null),
  };
}

/** "3 pairs would conflict", or why the pairs that share files are unchecked. */
export function collisionSummary(report: CollisionsReport | null): string | null {
  if (!report || !report.pairs.length) return null;
  if (report.check === 'no-clone')
    return `${report.pairs.length} pairs share files · unchecked: no local clone`;
  if (report.check === 'unreachable')
    return `${report.pairs.length} pairs share files · unchecked: could not fetch`;
  const conflicting = report.pairs.filter((pair) => (pair.conflicts?.length ?? 0) > 0).length;
  if (!conflicting) return 'no pull requests collide';
  return conflicting === 1 ? '1 pair would conflict' : `${conflicting} pairs would conflict`;
}
