/** The lists inside a pull request's details, each read defensively. */

export interface LabelLine {
  readonly name: string;
  /** Six hex digits without a `#`, as GitHub gives it; anything else is drawn grey. */
  readonly color: string;
}

export interface FileLine {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
  /** `ADDED`, `MODIFIED`, `DELETED`, `RENAMED`... */
  readonly change: string;
}

export interface CommitLine {
  /** The first seven characters of its hash. */
  readonly oid: string;
  readonly headline: string;
  readonly date: string;
  readonly authors: readonly string[];
}

type Json = Record<string, unknown>;

export const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isString = (value: unknown): value is string => typeof value === 'string';
export const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
export const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isString) : [];

/** Each entry of `value` that `parse` accepts. */
export function listOf<T>(value: unknown, parse: (entry: unknown) => T | null): T[] {
  return (Array.isArray(value) ? value : [])
    .map(parse)
    .filter((entry): entry is T => entry !== null);
}

export function parseLabel(value: unknown): LabelLine | null {
  if (!isObject(value) || !isString(value['name'])) return null;
  return { name: value['name'], color: isString(value['color']) ? value['color'] : '' };
}

export function parseFile(value: unknown): FileLine | null {
  if (!isObject(value) || !isString(value['path'])) return null;
  const { additions, deletions, change } = value;
  return {
    path: value['path'],
    additions: isCount(additions) ? additions : 0,
    deletions: isCount(deletions) ? deletions : 0,
    change: isString(change) ? change : '',
  };
}

export function parseCommit(value: unknown): CommitLine | null {
  if (!isObject(value) || !isString(value['oid']) || !isString(value['headline'])) return null;
  return {
    oid: value['oid'],
    headline: value['headline'],
    date: isString(value['date']) ? value['date'] : '',
    authors: strings(value['authors']),
  };
}
