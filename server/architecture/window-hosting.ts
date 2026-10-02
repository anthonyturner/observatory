import type { ArchitectureEdge } from './architecture-types.ts';
import type { ReferenceResolver } from './reference-resolver.ts';
import type { ScannedFile, ScannedRoute } from './scanned-source.ts';

export interface HostingInputs {
  /** The window names from the manifest. */
  readonly windows: readonly string[];
  readonly files: readonly ScannedFile[];
  readonly edges: readonly ArchitectureEdge[];
  readonly resolver: ReferenceResolver;
}

interface PlacedRoute {
  readonly file: string;
  readonly route: ScannedRoute;
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

/** The node a route shows, as one id or none. */
function componentOf({ file, route }: PlacedRoute, resolver: ReferenceResolver): string[] {
  const target = route.component;
  if (!target) return [];
  const id =
    target.module === null
      ? resolver.named(file, target.name)
      : resolver.exported(file, target.module, target.name);
  return id === null ? [] : [id];
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
    .filter(({ route }) => paths.has(route.path))
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
  const routes = inputs.files.flatMap(({ file, routes }) =>
    routes.map((route): PlacedRoute => ({ file, route })),
  );
  const outbound = outboundOf(inputs.edges);
  const hosts = new Map<string, string[]>();
  for (const window of inputs.windows) {
    for (const id of reachable(rootsOf(window, inputs, routes), outbound)) {
      hosts.set(id, [...(hosts.get(id) ?? []), window]);
    }
  }
  return hosts;
}
