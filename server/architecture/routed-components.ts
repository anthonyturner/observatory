import type { ReferenceResolver } from './reference-resolver.ts';
import type { ScannedFile, ScannedRoute } from './scanned-source.ts';

/** A route, and the file that declares it. */
export interface PlacedRoute {
  readonly file: string;
  readonly route: ScannedRoute;
}

export const placedRoutes = (files: readonly ScannedFile[]): PlacedRoute[] =>
  files.flatMap(({ file, routes }) => routes.map((route): PlacedRoute => ({ file, route })));

/** The node a route shows, as one id or none. */
export function componentOf({ file, route }: PlacedRoute, resolver: ReferenceResolver): string[] {
  const target = route.component;
  if (!target) return [];
  const id =
    target.module === null
      ? resolver.named(file, target.name)
      : resolver.exported(file, target.module, target.name);
  return id === null ? [] : [id];
}

/** Every node some route shows: the ones the router creates, with nothing injecting them. */
export const routedIds = (
  files: readonly ScannedFile[],
  resolver: ReferenceResolver,
): Set<string> => new Set(placedRoutes(files).flatMap((placed) => componentOf(placed, resolver)));
