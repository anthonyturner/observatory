import type { ArchitectureEdge } from './architecture-types.ts';
import type { ReferenceResolver } from './reference-resolver.ts';
import { componentOf, type PlacedRoute, placedRoutes } from './routed-components.ts';
import type { ScannedFile } from './scanned-source.ts';

export interface HostingInputs {
  /** The window names from the manifest. */
  readonly windows: readonly string[];
  readonly files: readonly ScannedFile[];
  readonly edges: readonly ArchitectureEdge[];
  readonly resolver: ReferenceResolver;
}

function outboundOf(edges: readonly ArchitectureEdge[]): Map<string, string[]> {
  const outbound = new Map<string, string[]>();
  for (const { from, to } of edges) outbound.set(from, [...(outbound.get(from) ?? []), to]);
  return outbound;
}

/** Every node reachable from `roots` along edges, the roots included. */
function reachable(roots: readonly string[], outbound: ReadonlyMap<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const queue = [...roots];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...(outbound.get(next) ?? []));
  }
  return seen;
}

/** The paths the app navigates to in its `case` for `window`. */
const pathsOf = (window: string, files: readonly ScannedFile[]): Set<string> =>
  new Set(
    files.flatMap(({ caseRoutes }) =>
      caseRoutes.filter(({ label }) => label === window).map(({ path }) => path),
    ),
  );

/** The components on the window's paths, with every component its lazy child routes show. */
function rootsOf(window: string, inputs: HostingInputs, routes: readonly PlacedRoute[]): string[] {
  const paths = pathsOf(window, inputs.files);
  return routes
    .filter(({ route }) => route.path !== null && paths.has(route.path))
    .flatMap((placed) => {
      const { file, route } = placed;
      const children =
        route.children === null ? null : inputs.resolver.module(file, route.children);
      const childRoutes = routes.filter((child) => child.file === children);
      return [placed, ...childRoutes].flatMap((shown) => componentOf(shown, inputs.resolver));
    });
}

/** For each node a window's routed component reaches, along any edge, the windows that reach it. */
export function windowsByNode(inputs: HostingInputs): Map<string, string[]> {
  const routes = placedRoutes(inputs.files);
  const outbound = outboundOf(inputs.edges);
  const hosts = new Map<string, string[]>();
  for (const window of inputs.windows) {
    for (const id of reachable(rootsOf(window, inputs, routes), outbound)) {
      hosts.set(id, [...(hosts.get(id) ?? []), window]);
    }
  }
  return hosts;
}
