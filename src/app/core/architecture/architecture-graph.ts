import {
  ArchitectureArea,
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  ArchitectureRuntime,
  EDGE_KINDS,
  EdgeKind,
} from './architecture.types';
import { NODE_KIND_LABEL } from './kind-look';

/**
 * What the scanner's marks say about a node: `unused`, nothing depends on it and nothing
 * starts it, so it may be dead code; `hot`, among the most often changed files.
 */
export type Heat = 'unused' | 'hot' | 'plain';

/** One node with what the map says about it. */
export interface MapEntry {
  readonly node: ArchitectureNode;
  /** The node's kind as the page words it. */
  readonly kindLabel: string;
  /** How many nodes depend on this one. */
  readonly dependents: number;
  /** How many nodes this one depends on. */
  readonly dependencies: number;
  readonly heat: Heat;
}

/** A node next to the centre, how it is linked to it, and the members read across the link. */
export interface Neighbour {
  readonly entry: MapEntry;
  readonly members: readonly string[];
  /** In the order of `EDGE_KINDS`; never empty. */
  readonly kinds: readonly EdgeKind[];
}

/** The kind a neighbour's link is drawn in: the first of its kinds. */
export const linkOf = ({ kinds }: Neighbour): EdgeKind => kinds[0] ?? EDGE_KINDS[0];

/** Every kind that joins a neighbour to the centre, as words. */
export const relationOf = ({ kinds }: Neighbour): string => kinds.join(', ');

/** One node with everything that depends on it and everything it depends on. */
export interface Neighbourhood {
  readonly centre: MapEntry;
  readonly dependents: readonly Neighbour[];
  readonly dependencies: readonly Neighbour[];
}

/** The map indexed for the page; `entries` runs from most depended-on to least. */
export interface ArchitectureGraph {
  readonly entries: readonly MapEntry[];
  readonly byId: ReadonlyMap<string, MapEntry>;
  readonly edges: readonly ArchitectureEdge[];
}

/** The areas of one runtime, such as the browser app or the API server, for the area filter. */
export interface AreaGroup {
  readonly label: string;
  readonly areas: readonly ArchitectureArea[];
}

const OTHER_RUNTIME = 'Other';

/** The areas by runtime, in the runtimes' order; an area of no known runtime goes last under "Other". */
export function groupAreas(
  areas: readonly ArchitectureArea[],
  runtimes: readonly ArchitectureRuntime[],
): AreaGroup[] {
  const known = new Set(runtimes.map(({ id }) => id));
  const groups = runtimes.map(({ id, label }) => ({
    label,
    areas: areas.filter(({ runtime }) => runtime === id),
  }));
  const others = areas.filter(({ runtime }) => !known.has(runtime));
  return [...groups, { label: OTHER_RUNTIME, areas: others }].filter(
    ({ areas: inGroup }) => inGroup.length > 0,
  );
}

/** The part of the map in view: one area and one window, or every one for null. */
export interface Scope {
  readonly area: string | null;
  readonly window: string | null;
}

export interface EntryFilter extends Scope {
  readonly query: string;
  readonly heat: Heat | null;
}

/** The scanner knows what starts a node without an edge to it (an entry file, a route), so its marks are not recounted. */
function heatOf({ marks }: ArchitectureNode): Heat {
  if (marks.includes('unused')) return 'unused';
  return marks.includes('hot') ? 'hot' : 'plain';
}

function tally(names: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
}

/** Each linked pair once, however many kinds of edge join them. */
const pairsOf = (edges: readonly ArchitectureEdge[]): [string, string][] => [
  ...new Map(
    edges.map(({ from, to }): [string, [string, string]] => [`${from}>${to}`, [from, to]]),
  ).values(),
];

const byWeight = (a: MapEntry, b: MapEntry): number =>
  b.dependents - a.dependents ||
  a.node.name.localeCompare(b.node.name) ||
  a.node.id.localeCompare(b.node.id);

export function graphOf(map: ArchitectureMap): ArchitectureGraph {
  const pairs = pairsOf(map.edges);
  const dependents = tally(pairs.map(([, to]) => to));
  const dependencies = tally(pairs.map(([from]) => from));
  const entries = map.nodes
    .map((node): MapEntry => ({
      node,
      kindLabel: NODE_KIND_LABEL[node.kind],
      dependents: dependents.get(node.id) ?? 0,
      dependencies: dependencies.get(node.id) ?? 0,
      heat: heatOf(node),
    }))
    .sort(byWeight);
  const byId = new Map(entries.map((entry) => [entry.node.id, entry]));
  return { entries, byId, edges: map.edges };
}

const inScope = ({ node }: MapEntry, { area, window }: Scope): boolean =>
  (area === null || node.area === area) && (window === null || node.windows.includes(window));

interface Link {
  readonly id: string;
  readonly edge: ArchitectureEdge;
}

const kindOrder = (a: EdgeKind, b: EdgeKind): number =>
  EDGE_KINDS.indexOf(a) - EDGE_KINDS.indexOf(b);

/** One neighbour per node at the far end of `links`, with every kind and member that joins them. */
function neighbours(graph: ArchitectureGraph, links: readonly Link[], scope: Scope): Neighbour[] {
  const joined = new Map<string, { members: Set<string>; kinds: Set<EdgeKind> }>();
  for (const { id, edge } of links) {
    const join = joined.get(id) ?? { members: new Set<string>(), kinds: new Set<EdgeKind>() };
    edge.members.forEach((member) => join.members.add(member));
    join.kinds.add(edge.kind);
    joined.set(id, join);
  }
  return [...joined].flatMap(([id, { members, kinds }]) => {
    const entry = graph.byId.get(id);
    return entry && inScope(entry, scope)
      ? [{ entry, members: [...members], kinds: [...kinds].sort(kindOrder) }]
      : [];
  });
}

/** The node `id` with its neighbours in `scope`; null when there is no such node. */
export function neighbourhoodOf(
  graph: ArchitectureGraph,
  id: string,
  scope: Scope,
): Neighbourhood | null {
  const centre = graph.byId.get(id);
  if (!centre) return null;
  const inbound = graph.edges
    .filter((edge) => edge.to === id)
    .map((edge) => ({ id: edge.from, edge }));
  const outbound = graph.edges
    .filter((edge) => edge.from === id)
    .map((edge) => ({ id: edge.to, edge }));
  return {
    centre,
    dependents: neighbours(graph, inbound, scope),
    dependencies: neighbours(graph, outbound, scope),
  };
}

/** The entries a search for `query` shows, most depended-on first. */
export function entriesMatching(graph: ArchitectureGraph, filter: EntryFilter): MapEntry[] {
  const wanted = filter.query.trim().toLowerCase();
  return graph.entries.filter(
    (entry) =>
      inScope(entry, filter) &&
      (filter.heat === null || entry.heat === filter.heat) &&
      entry.node.name.toLowerCase().includes(wanted),
  );
}

/** How many entries carry `heat`. */
export const countOf = (graph: ArchitectureGraph, heat: Heat): number =>
  graph.entries.filter((entry) => entry.heat === heat).length;

/** One member of the centre, and how many of its dependents read it. */
export interface MemberUse {
  readonly member: string;
  readonly readers: number;
}

/** The centre's members its dependents read, most read first. */
export function memberUse(dependents: readonly Neighbour[]): MemberUse[] {
  const readers = tally(dependents.flatMap((neighbour) => neighbour.members));
  return [...readers]
    .map(([member, count]) => ({ member, readers: count }))
    .sort((a, b) => b.readers - a.readers || a.member.localeCompare(b.member));
}
