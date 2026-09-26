/** An open pull request and the files it changes. */
export interface PullFiles {
  readonly number: number;
  readonly files: readonly string[];
}

/** Two open pull requests that change at least one file in common. */
export interface SharedPair {
  readonly a: number;
  readonly b: number;
  readonly files: readonly string[];
}

/** A shared pair, and what merging them together would do. */
export interface Collision extends SharedPair {
  /** The files that would conflict, `[]` when they merge cleanly, or null when unchecked. */
  readonly conflicts: readonly string[] | null;
}

/** Every pair that shares a file, lower number first: the only pairs that can conflict. */
export function sharedPairs(pulls: readonly PullFiles[]): SharedPair[] {
  const sorted = [...pulls].sort((x, y) => x.number - y.number);
  const pairs: SharedPair[] = [];
  sorted.forEach((first, index) => {
    const mine = new Set(first.files);
    for (const second of sorted.slice(index + 1)) {
      const files = second.files.filter((file) => mine.has(file));
      if (files.length) pairs.push({ a: first.number, b: second.number, files });
    }
  });
  return pairs;
}

/**
 * `owner/name` from a remote URL on GitHub, over HTTPS or SSH, or null for
 * anywhere else. Lower-cased, as GitHub's names are not case-sensitive.
 */
export function githubRepoOf(url: string): string | null {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
}

/** The `origin` remote's URL from a `.git/config` file's text. */
export function originUrlOf(config: string): string | null {
  let inOrigin = false;
  for (const raw of config.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) inOrigin = /^\[remote\s+"origin"\]$/.test(line);
    else if (inOrigin) {
      const match = /^url\s*=\s*(.+)$/.exec(line);
      if (match) return match[1].trim();
    }
  }
  return null;
}

/**
 * The conflicted files from `git merge-tree --write-tree --name-only
 * --no-messages`: the first line is the tree, the rest (to a blank line) the
 * files that conflict.
 */
export function conflictedFiles(output: string): string[] {
  const [, ...rest] = output.split(/\r?\n/);
  const end = rest.indexOf('');
  return [...new Set(end === -1 ? rest : rest.slice(0, end))];
}
