import {
  MAP_SCHEMA,
  type ArchitectureArea,
  type ArchitectureEdge,
  type ArchitectureMap,
  type ArchitectureNode,
  type ArchitectureRuntime,
  type EdgeKind,
  type NodeKind,
} from '../../../server/architecture/architecture-types.ts';
import { analysed } from './synthetic-analysis.ts';
import { pick, randomFrom } from './synthetic-random.ts';

export interface SyntheticSize {
  /** Nodes in the whole map, outside services and programs included. */
  readonly nodes: number;
  /** Edges to try to place; a few are skipped as repeats, so the map holds slightly fewer. */
  readonly edges: number;
  readonly seed: number;
}

const BROWSER_SHARE = 0.62;
const SERVER_SHARE = 0.3;
const NODES_PER_AREA = 11;
const CHILD_SHARE = 0.18;
const SAME_AREA_SHARE = 0.7;
const SAME_RUNTIME_SHARE = 0.97;

/** Areas sit in this many tiers, and an area depends on lower tiers only, as a layered app does. */
const TIERS = 6;
const tierOf = (areaId: string): number => Number(areaId.split('-').at(-1)) % TIERS;

const CODE_KINDS: readonly EdgeKind[] = [
  'injects',
  'injects',
  'uses',
  'calls',
  'imports',
  'provides',
  'extends',
];

const BROWSER: ArchitectureRuntime = {
  id: 'browser',
  label: 'Browser app',
  kind: 'browser',
  root: 'src/app',
};
const SERVER: ArchitectureRuntime = {
  id: 'server',
  label: 'API server',
  kind: 'server',
  root: 'server',
};
const WEB: ArchitectureRuntime = {
  id: 'web',
  label: 'Outside services',
  kind: 'web-service',
  root: '',
};
const PROGRAMS: ArchitectureRuntime = {
  id: 'programs',
  label: 'Spawned programs',
  kind: 'program',
  root: '',
};
const RUNTIMES: readonly ArchitectureRuntime[] = [BROWSER, SERVER, WEB, PROGRAMS];

/** An outside runtime has the one area that is the runtime itself. */
const outsideArea = ({ id, label }: ArchitectureRuntime): ArchitectureArea => ({
  id,
  label,
  runtime: id,
  folder: '',
});
const WEB_AREA = outsideArea(WEB);
const PROGRAMS_AREA = outsideArea(PROGRAMS);

const areaCount = (nodes: number): number => Math.max(1, Math.round(nodes / NODES_PER_AREA));

function areasFor(runtime: ArchitectureRuntime, count: number): ArchitectureArea[] {
  return Array.from({ length: count }, (_, at) => ({
    id: `${runtime.id}:area-${at}`,
    label: `${runtime.id} area ${at}`,
    runtime: runtime.id,
    folder: `${runtime.root}/area-${at}`,
  }));
}

function nodeIn(
  area: ArchitectureArea,
  at: number,
  kind: NodeKind,
  rand: () => number,
): ArchitectureNode {
  const name = `${kind[0]?.toUpperCase()}${kind.slice(1)}${area.id.split('-').at(-1)}x${at}`;
  const file = `${area.folder}/${name.toLowerCase()}.ts`;
  const members = Array.from({ length: Math.floor(rand() * 8) }, (_, member) => ({
    name: `member${member}`,
    kind: 'method' as const,
    visibility: (['public', 'protected', 'private'] as const)[Math.floor(rand() * 3)] ?? 'public',
  }));
  return {
    id: `${file}#${name}`,
    name,
    kind,
    file,
    area: area.id,
    group: '',
    providedIn: kind === 'service' || kind === 'store' ? 'root' : null,
    windows: [],
    parent: null,
    members,
    endpoint: kind === 'route' ? { method: 'GET', path: '/api/' + name.toLowerCase() } : null,
    loc: kind === 'route' ? 0 : 20 + Math.floor(rand() * 300),
    metrics: { fanIn: 0, fanOut: 0, churn: Math.floor(rand() * 20) },
    marks: [],
  };
}

const BROWSER_KINDS: readonly NodeKind[] = [
  'component',
  'component',
  'component',
  'service',
  'store',
  'token',
  'function',
];
const SERVER_KINDS: readonly NodeKind[] = ['module', 'module', 'route'];

function draftNodes(
  size: SyntheticSize,
  rand: () => number,
): { areas: ArchitectureArea[]; nodes: ArchitectureNode[] } {
  const browser = Math.round(size.nodes * BROWSER_SHARE);
  const server = Math.round(size.nodes * SERVER_SHARE);
  const outside = Math.max(2, size.nodes - browser - server);
  const areas = [
    ...areasFor(BROWSER, areaCount(browser)),
    ...areasFor(SERVER, areaCount(server)),
    WEB_AREA,
    PROGRAMS_AREA,
  ];
  const nodes: ArchitectureNode[] = [];
  const fill = (runtime: string, count: number, kinds: readonly NodeKind[]): void => {
    const own = areas.filter((area) => area.runtime === runtime);
    for (let at = 0; at < count; at++) {
      const kind = kinds[Math.floor(rand() * kinds.length)] ?? 'module';
      const area = own[at % own.length];
      if (area) nodes.push(nodeIn(area, at, kind, rand));
    }
  };
  fill(BROWSER.id, browser, BROWSER_KINDS);
  fill(SERVER.id, server, SERVER_KINDS);
  const webCount = Math.ceil(outside * 0.6);
  for (let at = 0; at < outside; at++) {
    const web = at < webCount;
    nodes.push({
      ...nodeIn(web ? WEB_AREA : PROGRAMS_AREA, at, 'external', rand),
      id: `external:${web ? 'service' : 'program'}-${at}`,
      name: `${web ? 'service' : 'program'}-${at}`,
      file: '',
      loc: 0,
      members: [],
    });
  }
  return { areas, nodes: parentChildren(nodes, rand) };
}

/** Gives some components a parent from their own area, as an Angular template renders a child. */
function parentChildren(nodes: ArchitectureNode[], rand: () => number): ArchitectureNode[] {
  const parents = new Map<string, ArchitectureNode[]>();
  return nodes.map((node) => {
    if (node.kind !== 'component') return node;
    const candidates = parents.get(node.area) ?? [];
    const parent =
      candidates.length > 0 && rand() < CHILD_SHARE
        ? candidates[Math.floor(rand() * candidates.length)]
        : undefined;
    if (!parent) {
      parents.set(node.area, [...candidates, node]);
      return node;
    }
    return { ...node, parent: parent.id };
  });
}

function draftEdges(
  nodes: readonly ArchitectureNode[],
  count: number,
  rand: () => number,
): ArchitectureEdge[] {
  const byArea = new Map<string, ArchitectureNode[]>();
  const byRuntime = new Map<string, ArchitectureNode[]>();
  for (const node of nodes) {
    const runtime = node.area.split(':')[0] ?? node.area;
    byArea.set(node.area, [...(byArea.get(node.area) ?? []), node]);
    byRuntime.set(runtime, [...(byRuntime.get(runtime) ?? []), node]);
  }
  const seen = new Set<string>();
  const edges: ArchitectureEdge[] = [];
  const add = (
    from: ArchitectureNode | undefined,
    to: ArchitectureNode | undefined,
    kind: EdgeKind,
  ): void => {
    if (!from || !to || from.id === to.id) return;
    const key = `${from.id}>${to.id}>${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({
      from: from.id,
      to: to.id,
      kind,
      how: kind === 'injects' ? 'inject' : null,
      members: [],
      marks: [],
    });
  };
  const routes = nodes.filter((node) => node.kind === 'route');
  const modules = nodes.filter((node) => node.kind === 'module');
  const services = nodes.filter(
    (node) => node.file === '' && node.id.startsWith('external:service'),
  );
  const programs = nodes.filter(
    (node) => node.file === '' && node.id.startsWith('external:program'),
  );
  const browserNodes = byRuntime.get('browser') ?? [];
  for (const route of routes) {
    add(pick(browserNodes, rand), route, 'requests');
    add(route, pick(modules, rand), 'handles');
  }
  for (const external of services) add(pick(modules, rand), external, 'reaches');
  for (const program of programs) add(pick(modules, rand), program, 'spawns');
  const internal = nodes.filter((node) => node.file !== '');
  for (let attempt = 0; edges.length < count && attempt < count * 20; attempt++) {
    const from = pick(
      internal.filter((node) => node.kind !== 'route'),
      rand,
    );
    if (!from) break;
    const roll = rand();
    const runtime = from.area.split(':')[0] ?? from.area;
    const lower = (byRuntime.get(runtime) ?? []).filter(
      (node) => tierOf(node.area) < tierOf(from.area),
    );
    const pool =
      roll < SAME_AREA_SHARE ? byArea.get(from.area) : roll < SAME_RUNTIME_SHARE ? lower : internal;
    const to = pick(
      (pool ?? internal).filter((node) => node.kind !== 'route'),
      rand,
    );
    add(from, to, pick(CODE_KINDS, rand) ?? 'imports');
  }
  return edges;
}

/** A made-up map of any size that obeys the contract, for testing how a view copes with scale. */
export function syntheticMap(size: SyntheticSize): ArchitectureMap {
  const rand = randomFrom(size.seed);
  const { areas, nodes } = draftNodes(size, rand);
  const drafted = draftEdges(nodes, size.edges, rand);
  const analysis = analysed(nodes, drafted, rand);
  return {
    schema: MAP_SCHEMA,
    project: `synthetic-${size.nodes}`,
    scannedAt: '2026-10-08T00:00:00.000Z',
    churnDays: 90,
    runtimes: RUNTIMES,
    areas,
    windows: [],
    nodes: analysis.nodes,
    edges: analysis.edges,
    cycles: analysis.cycles,
  };
}
