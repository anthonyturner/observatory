import type {
  ArchitectureArea,
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureRuntime,
  EdgeKind,
} from './architecture-types.ts';
import { newNode, type NodeContext, reachesOutside } from './map-nodes.ts';
import { type PathAlias, resolveModule } from './module-resolution.ts';
import { serviceOfImport } from './network-sdks.ts';
import type { ScannedEndpoint, ScannedFile, ScannedOutbound } from './scanned-source.ts';
import { byText } from './sort-order.ts';
import { textResolver, type TextResolver } from './text-resolver.ts';
import { UNKNOWN_TEXT } from './text-parts.ts';

export interface NetworkInputs {
  /** Every scanned file, whether or not it holds a node. */
  readonly files: readonly ScannedFile[];
  /** The nodes each file holds, in the order it declares them; its first is the one links join. */
  readonly nodesByFile: ReadonlyMap<string, readonly ArchitectureNode[]>;
  readonly context: NodeContext;
  readonly aliases: readonly PathAlias[];
}

/** The routes the API server answers, the outside services the code reaches, and the links between them. */
export interface NetworkLinks {
  readonly nodes: ArchitectureNode[];
  readonly edges: ArchitectureEdge[];
  /** The outside runtimes that something reaches, and nothing else. */
  readonly runtimes: ArchitectureRuntime[];
  readonly areas: ArchitectureArea[];
}

const WEB_SERVICE: ArchitectureRuntime = {
  id: 'web-service',
  label: 'Web services',
  kind: 'web-service',
  root: '',
};
const PROGRAM: ArchitectureRuntime = {
  id: 'program',
  label: 'Programs',
  kind: 'program',
  root: '',
};

/**
 * The host, and port if any, of an absolute URL. It ends where a path, query
 * or fragment begins, or where something unknown is appended, as in
 * `${API_ROOT}${path}`. A host with an unknown part inside it does not match.
 */
const ABSOLUTE_URL = new RegExp(
  `^(?:https?|wss?)://([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\\d+)?)(?=[/?#${UNKNOWN_TEXT}]|$)`,
  'i',
);
const QUERY_OR_FRAGMENT = /[?#].*$/;
const PATH_SEPARATORS = /[\\/]/;
const EXECUTABLE_SUFFIX = /\.exe$/i;

const segmentsOf = (path: string): string[] =>
  path
    .replace(QUERY_OR_FRAGMENT, '')
    .split('/')
    .filter((segment) => segment !== '');

const isParameter = (segment: string): boolean => segment.startsWith(':');

/**
 * How far a request path is from a route's, 0 for the same, up to MISMATCH:
 * a route's `:id` takes any segment (1), and a segment of the request that only
 * a run could tell can stand for a route's fixed one (2), but less surely.
 */
const MISMATCH = 3;
function distance(request: readonly string[], route: readonly string[]): number {
  if (request.length !== route.length) return MISMATCH;
  const steps = request.map((segment, at) => {
    const fixed = route[at] ?? '';
    if (segment === fixed) return 0;
    if (isParameter(fixed)) return 1;
    return segment.includes(UNKNOWN_TEXT) ? 2 : MISMATCH;
  });
  return Math.max(...steps, 0);
}

interface Route {
  readonly node: ArchitectureNode;
  readonly segments: readonly string[];
}

/**
 * The routes a request could reach: those nearest to it that fit at all. A
 * request path whose first segment is unknown, such as a base URL set at run
 * time, is matched to nothing, since it would fit any route of the right length.
 */
function routesFor(
  method: string | null,
  path: string,
  routes: readonly Route[],
): ArchitectureNode[] {
  const requested = segmentsOf(path);
  if (requested.length === 0 || requested[0]?.includes(UNKNOWN_TEXT)) return [];
  const fits = routes
    .filter(({ node }) => method === null || node.endpoint?.method === method)
    .map(({ node, segments }) => ({ node, away: distance(requested, segments) }))
    .filter(({ away }) => away < MISMATCH);
  const nearest = Math.min(...fits.map(({ away }) => away));
  return fits.filter(({ away }) => away === nearest).map(({ node }) => node);
}

function lastSegment(program: string): string {
  return (program.split(PATH_SEPARATORS).at(-1) ?? '').replace(EXECUTABLE_SUFFIX, '');
}

/**
 * Finds the routes the API server answers, with the code behind each, then
 * links what the code requests, reaches and spawns. Every link starts from the
 * first node of the file it was found in, unless a declaration (a class, say)
 * holds the call itself, which owns it.
 */
class NetworkScan {
  private readonly text: TextResolver;
  private readonly paths: ReadonlySet<string>;
  private readonly routes = new Map<string, Route>();
  private readonly edges = new Map<string, ArchitectureEdge>();
  private readonly externals = new Map<string, ArchitectureNode>();

  private readonly inputs: NetworkInputs;

  constructor(inputs: NetworkInputs) {
    this.inputs = inputs;
    this.text = textResolver(inputs.files, inputs.aliases);
    this.paths = new Set(inputs.files.map(({ file }) => file));
  }

  /** Routes first, since a request is matched against every route there is. */
  run(): NetworkLinks {
    const { files, context } = this.inputs;
    const isServer = ({ file }: ScannedFile): boolean =>
      context.placements.get(file)?.runtime.kind === 'server';
    for (const scanned of files.filter(isServer)) {
      for (const endpoint of scanned.endpoints) this.addRoute(scanned, endpoint);
    }
    for (const scanned of files.filter(reachesOutside)) {
      for (const outbound of scanned.outbound) this.addOutbound(scanned, outbound);
      this.addServices(scanned);
    }
    return this.links();
  }

  private firstNode(file: string): ArchitectureNode | undefined {
    return this.inputs.nodesByFile.get(file)?.[0];
  }

  private ownerNode(file: string, owner: string | null): ArchitectureNode | undefined {
    return (
      this.inputs.nodesByFile.get(file)?.find(({ name }) => name === owner) ?? this.firstNode(file)
    );
  }

  private link(from: string, to: string, kind: EdgeKind): void {
    this.edges.set(
      `${from}
${to}
${kind}`,
      { from, to, kind, how: null, members: [], marks: [] },
    );
  }

  /** The id of the outside node called `name`, which this makes if it is the first time. */
  private external(runtime: ArchitectureRuntime, name: string): string {
    const id = `external:${name}`;
    if (!this.externals.has(id)) {
      const fields = { id, name, kind: 'external', file: '', area: runtime.id, group: '' } as const;
      this.externals.set(id, newNode(fields));
    }
    return id;
  }

  /** One route per verb and path, however many files serve it. */
  private addRoute(scanned: ScannedFile, { method, path, handlers }: ScannedEndpoint): void {
    const resolved = this.text(scanned.file, path);
    const place = this.inputs.context.placements.get(scanned.file);
    if (!resolved.startsWith('/') || resolved.includes(UNKNOWN_TEXT) || !place) return;
    const id = `route:${method} ${resolved}`;
    if (!this.routes.has(id)) {
      const node = newNode({
        id,
        name: `${method} ${resolved}`,
        kind: 'route',
        file: scanned.file,
        area: place.area,
        group: place.group,
        endpoint: { method, path: resolved },
      });
      this.routes.set(id, { node, segments: segmentsOf(resolved) });
    }
    for (const { id: to } of this.codeBehind(scanned, handlers)) this.link(id, to, 'handles');
  }

  /** The nodes of the files a handler uses by import; the declaring file's own when it uses none. */
  private codeBehind(scanned: ScannedFile, handlers: readonly string[]): ArchitectureNode[] {
    const imported = new Map(scanned.imports.map(({ local, module }) => [local, module]));
    const behind = handlers.flatMap((name) => {
      const module = imported.get(name);
      if (module === undefined) return [];
      const target = resolveModule(scanned.file, module, this.paths, this.inputs.aliases);
      return target === null ? [] : (this.firstNode(target) ?? []);
    });
    const own = this.firstNode(scanned.file);
    return behind.length > 0 ? behind : own ? [own] : [];
  }

  private addOutbound(scanned: ScannedFile, outbound: ScannedOutbound): void {
    const from = this.ownerNode(scanned.file, outbound.owner);
    if (!from) return;
    const target = this.text(scanned.file, outbound.target);
    if (outbound.via === 'process') {
      const program = lastSegment(target);
      if (program !== '' && !program.includes(UNKNOWN_TEXT)) {
        this.link(from.id, this.external(PROGRAM, program), 'spawns');
      }
      return;
    }
    const host = ABSOLUTE_URL.exec(target)?.[1];
    if (host !== undefined) {
      this.link(from.id, this.external(WEB_SERVICE, host.toLowerCase()), 'reaches');
      return;
    }
    if (!target.startsWith('/')) return;
    for (const route of routesFor(outbound.method, target, [...this.routes.values()])) {
      this.link(from.id, route.id, 'requests');
    }
  }

  /** An import of a network package reaches the service it talks to, from the file's first node. */
  private addServices({ file, specifiers }: ScannedFile): void {
    const first = this.firstNode(file);
    for (const specifier of specifiers) {
      const service = serviceOfImport(specifier);
      if (first && service !== null) {
        this.link(first.id, this.external(WEB_SERVICE, service), 'reaches');
      }
    }
  }

  private links(): NetworkLinks {
    const externals = [...this.externals.values()];
    const reached = ({ id }: ArchitectureRuntime): boolean =>
      externals.some(({ area }) => area === id);
    const outside = [WEB_SERVICE, PROGRAM].filter(reached);
    return {
      nodes: [...[...this.routes.values()].map(({ node }) => node), ...externals],
      edges: [...this.edges.values()],
      runtimes: outside,
      areas: outside.map(({ id, label }) => ({ id, label, runtime: id, folder: '' })),
    };
  }
}

export const networkLinks = (inputs: NetworkInputs): NetworkLinks => new NetworkScan(inputs).run();
