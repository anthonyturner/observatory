import { MAP_SCHEMA, type ArchitectureMap } from '../../server/architecture/architecture-types.ts';

/** The id of the script element that carries the map in the page. */
export const MAP_ELEMENT_ID = 'architecture-map';

const LISTS = ['runtimes', 'areas', 'nodes', 'edges', 'cycles'] as const;

const RESCAN = 'Scan the project again with npm run arch:scan.';

const schemaOf = (value: unknown): unknown =>
  typeof value === 'object' && value !== null && 'schema' in value ? value.schema : undefined;

const lacksList = (value: unknown, name: string): boolean =>
  typeof value !== 'object' || value === null || !Array.isArray(Reflect.get(value, name));

/**
 * Whether `value` is the shape of a map this viewer reads. This is a first look, at the
 * edge: the builder has already checked every edge, count and mark before it wrote the page.
 */
function isReadableMap(value: unknown): value is ArchitectureMap {
  return schemaOf(value) === MAP_SCHEMA && !LISTS.some((name) => lacksList(value, name));
}

function whyUnreadable(value: unknown): string {
  if (schemaOf(value) !== MAP_SCHEMA) {
    return `This map is not schema ${MAP_SCHEMA} (it says ${String(schemaOf(value))}). ${RESCAN}`;
  }
  const missing = LISTS.filter((name) => lacksList(value, name));
  return `This map is missing ${missing.join(', ')}. ${RESCAN}`;
}

/** Reads the map from the page's JSON, or says plainly why it cannot. */
export function readMap(json: string | null | undefined): ArchitectureMap {
  if (!json) throw new Error('This page carries no architecture map.');
  const value: unknown = JSON.parse(json);
  if (!isReadableMap(value)) throw new Error(whyUnreadable(value));
  return value;
}
