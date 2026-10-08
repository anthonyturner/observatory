import { byText } from './sort-order.ts';
import type { ArchitectureArea, ArchitectureRuntime } from './architecture-types.ts';

/** Where a file sits: its area, and the folder below that area's folder. */
export interface Place {
  readonly area: string;
  readonly group: string;
}

/** How a runtime's source folders divide into areas. */
export interface AreaLayout {
  /** Every area some file of the runtime falls in. */
  readonly areas: readonly ArchitectureArea[];
  placeOf(file: string): Place;
}

/** The area for files directly in a runtime's root; its path is the root itself. */
const SHELL_PATH = '.';
const SHELL_LABEL = 'Shell';

/**
 * A top folder is a layer, such as `core/` or `features/`, when it holds at
 * least this many subfolders and more of them than loose files. Three is the
 * fewest that still reads as a list of parts: a folder with `tools/` and
 * `data/` beside its own code is one feature, not a layer of two.
 */
const LAYER_MIN_SUBFOLDERS = 3;

const WORD_SEPARATORS = /[-_]+/g;

/** `agent-speech` as "Agent speech". */
function labelOf(folder: string): string {
  const words = folder.replace(WORD_SEPARATORS, ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/** The top folders that are layers; `belowRoot` is every file's path split into its segments. */
function layersOf(belowRoot: readonly (readonly string[])[]): Set<string> {
  const loose = new Map<string, number>();
  const subfolders = new Map<string, Set<string>>();
  for (const [top, next, ...rest] of belowRoot) {
    if (top === undefined || next === undefined) continue;
    if (rest.length === 0) loose.set(top, (loose.get(top) ?? 0) + 1);
    else subfolders.set(top, (subfolders.get(top) ?? new Set<string>()).add(next));
  }
  const isLayer = ([top, parts]: [string, Set<string>]): boolean =>
    parts.size >= LAYER_MIN_SUBFOLDERS && (loose.get(top) ?? 0) < parts.size;
  return new Set([...subfolders].filter(isLayer).map(([top]) => top));
}

/** What an area is called before a clash with another of the same name is settled. */
const nameOf = (path: readonly string[]): string =>
  path[0] === SHELL_PATH ? SHELL_LABEL : labelOf(path.at(-1) ?? '');

/** The folders, below the root, that name a file's area. */
function areaPathOf(folders: readonly string[], layers: ReadonlySet<string>): string[] {
  const [top, second] = folders;
  if (top === undefined) return [SHELL_PATH];
  return layers.has(top) && second !== undefined ? [top, second] : [top];
}

/**
 * Divides a runtime's source files into areas by folder. Files directly in the
 * root form a shell area. Each other top folder is an area, except a layer
 * (see LAYER_MIN_SUBFOLDERS), whose subfolders are one area each. Whatever
 * the area's folder holds in subfolders is a group.
 */
export function areaLayoutOf(runtime: ArchitectureRuntime, files: readonly string[]): AreaLayout {
  const prefix = runtime.root === '' ? '' : `${runtime.root}/`;
  const foldersOf = (file: string): string[] => file.slice(prefix.length).split('/').slice(0, -1);
  const layers = layersOf(files.map((file) => file.slice(prefix.length).split('/')));

  const placeOf = (file: string): Place => {
    const folders = foldersOf(file);
    const taken = areaPathOf(folders, layers);
    const depth = taken[0] === SHELL_PATH ? 0 : taken.length;
    return { area: `${runtime.id}:${taken.join('/')}`, group: folders[depth] ?? '' };
  };

  const taken = new Map<string, string[]>();
  for (const file of files) {
    const path = areaPathOf(foldersOf(file), layers);
    taken.set(`${runtime.id}:${path.join('/')}`, path);
  }
  const names = [...taken.values()].map(nameOf);
  const areas = [...taken]
    .map(([id, path]): ArchitectureArea => {
      const name = nameOf(path);
      const isShared = path.length > 1 && names.filter((each) => each === name).length > 1;
      return {
        id,
        label: isShared ? `${name} (${path[0]})` : name,
        runtime: runtime.id,
        folder: path[0] === SHELL_PATH ? runtime.root : `${prefix}${path.join('/')}`,
      };
    })
    .sort((a, b) => byText(a.id, b.id));
  return { areas, placeOf };
}
