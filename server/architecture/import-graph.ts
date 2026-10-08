import { byText } from './sort-order.ts';
import { type PathAlias, resolveModule } from './module-resolution.ts';
import type { ScannedFile } from './scanned-source.ts';

/** One file importing another, both scanned. */
export interface FileImport {
  readonly from: string;
  readonly to: string;
}

/** How the scanned files import each other. */
export interface ImportGraph {
  readonly imports: readonly FileImport[];
  /** Each import cycle as the files around it, in order, from its smallest path, with no file repeated. */
  readonly cycles: readonly (readonly string[])[];
}

/** The files each file imports, by path; a package, or a file that was not scanned, is no import. */
function importsByFile(
  files: readonly ScannedFile[],
  aliases: readonly PathAlias[],
): Map<string, string[]> {
  const paths = new Set(files.map(({ file }) => file));
  return new Map(
    files.map(({ file, specifiers }) => {
      const targets = specifiers.flatMap(
        (specifier) => resolveModule(file, specifier, paths, aliases) ?? [],
      );
      return [file, [...new Set(targets)].filter((target) => target !== file).sort()];
    }),
  );
}

/** The strongly connected components: sets of files that can all reach one another. */
function componentsOf(imports: ReadonlyMap<string, readonly string[]>): string[][] {
  const [index, low, onStack] = [
    new Map<string, number>(),
    new Map<string, number>(),
    new Set<string>(),
  ];
  const [stack, components] = [new Array<string>(), new Array<string[]>()];
  const visit = (file: string): void => {
    index.set(file, index.size);
    low.set(file, index.get(file) ?? 0);
    stack.push(file);
    onStack.add(file);
    for (const next of imports.get(file) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(file, Math.min(low.get(file) ?? 0, low.get(next) ?? 0));
      } else if (onStack.has(next)) {
        low.set(file, Math.min(low.get(file) ?? 0, index.get(next) ?? 0));
      }
    }
    if (low.get(file) !== index.get(file)) return;
    const component: string[] = [];
    for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
      onStack.delete(member);
      component.push(member);
      if (member === file) break;
    }
    components.push(component);
  };
  for (const file of imports.keys()) if (!index.has(file)) visit(file);
  return components;
}

/** The shortest way from `start` to `goal` through `members` only, both ends included. */
function shortestPath(
  start: string,
  goal: string,
  imports: ReadonlyMap<string, readonly string[]>,
  members: ReadonlySet<string>,
): string[] {
  const cameFrom = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  for (let next = queue.shift(); next !== undefined && !cameFrom.has(goal); next = queue.shift()) {
    for (const target of imports.get(next) ?? []) {
      if (!members.has(target) || cameFrom.has(target)) continue;
      cameFrom.set(target, next);
      queue.push(target);
    }
  }
  const path: string[] = [];
  for (let at: string | null | undefined = goal; at; at = cameFrom.get(at)) path.unshift(at);
  return path;
}

/** `cycle` starting from its smallest path, so one cycle is one list however it was found. */
function rotated(cycle: readonly string[]): string[] {
  const smallest = cycle.reduce((best, file) => (file < best ? file : best));
  const at = cycle.indexOf(smallest);
  return [...cycle.slice(at), ...cycle.slice(0, at)];
}

/** For every import inside a component, the shortest cycle that import closes. */
function cyclesIn(
  component: readonly string[],
  imports: ReadonlyMap<string, readonly string[]>,
): string[][] {
  const members = new Set(component);
  return component.flatMap((from) =>
    (imports.get(from) ?? [])
      .filter((to) => members.has(to))
      .map((to) => rotated(shortestPath(to, from, imports, members))),
  );
}

/**
 * The import graph of the scanned files, and its cycles. Each import that sits
 * on a cycle is given the shortest cycle through it; a cycle several of its
 * imports close is listed once.
 */
export function importGraphOf(
  files: readonly ScannedFile[],
  aliases: readonly PathAlias[],
): ImportGraph {
  const imports = importsByFile(files, aliases);
  const cycles = componentsOf(imports)
    .filter((component) => component.length > 1)
    .flatMap((component) => cyclesIn(component, imports));
  const unique = new Map(cycles.map((cycle) => [cycle.join('\n'), cycle]));
  return {
    imports: [...imports].flatMap(([from, targets]) => targets.map((to) => ({ from, to }))),
    cycles: [...unique.values()].sort((a, b) => byText(a.join('\n'), b.join('\n'))),
  };
}
