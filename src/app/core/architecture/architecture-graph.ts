import { ArchitectureEdge, ArchitectureMap, ArchitectureNode } from './architecture.types';

/** `unused`: nothing injects it, so it may be dead code. `hot`: many classes lean on it. */
export type Heat = 'unused' | 'hot' | 'plain';

/** A class this many others inject is one a change to it will be felt widely. */
export const HOT_DEPENDENTS = 5;

/** One class with what the map says about it. */
export interface MapEntry {
  readonly node: ArchitectureNode;
  /** How many classes inject this one. */
  readonly dependents: number;
  /** How many classes this one injects. */
  readonly dependencies: number;
  readonly heat: Heat;
}

/** A class next to the centre, and the members read across the injection between them. */
export interface Neighbour {
  readonly entry: MapEntry;
  readonly members: readonly string[];
}

/** One class with everything that injects it and everything it injects. */
export interface Neighbourhood {
  readonly centre: MapEntry;
  readonly dependents: readonly Neighbour[];
  readonly dependencies: readonly Neighbour[];
}

/** The map indexed for the page; `entries` runs from most depended-on to least. */
export interface ArchitectureGraph {
  readonly entries: readonly MapEntry[];
  readonly byName: ReadonlyMap<string, MapEntry>;
  readonly edges: readonly ArchitectureEdge[];
}

export interface EntryFilter {
  readonly query: string;
  readonly area: string | null;
  readonly heat: Heat | null;
}

/** Nothing injects a component: Angular creates it from a template, so it is never `unused`. */
function heatOf(node: ArchitectureNode, dependents: number): Heat {
  if (node.kind === 'component') return 'plain';
  if (dependents === 0) return 'unused';
  return dependents >= HOT_DEPENDENTS ? 'hot' : 'plain';
}

function tally(names: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
}

const byWeight = (a: MapEntry, b: MapEntry): number =>
  b.dependents - a.dependents || a.node.name.localeCompare(b.node.name);

export function graphOf(map: ArchitectureMap): ArchitectureGraph {
  const dependents = tally(map.edges.map((edge) => edge.to));
  const dependencies = tally(map.edges.map((edge) => edge.from));
  const entries = map.nodes
    .map((node): MapEntry => {
      const count = dependents.get(node.name) ?? 0;
      return {
        node,
        dependents: count,
        dependencies: dependencies.get(node.name) ?? 0,
        heat: heatOf(node, count),
      };
    })
    .sort(byWeight);
  const byName = new Map(entries.map((entry) => [entry.node.name, entry]));
  return { entries, byName, edges: map.edges };
}

const inArea = (entry: MapEntry, area: string | null): boolean =>
  area === null || entry.node.area === area;

function neighbours(
  graph: ArchitectureGraph,
  links: readonly { readonly name: string; readonly members: readonly string[] }[],
  area: string | null,
): Neighbour[] {
  return links.flatMap(({ name, members }) => {
    const entry = graph.byName.get(name);
    return entry && inArea(entry, area) ? [{ entry, members }] : [];
  });
}

/** The class called `name` with its neighbours in `area` (every area for null); null if unknown. */
export function neighbourhoodOf(
  graph: ArchitectureGraph,
  name: string,
  area: string | null,
): Neighbourhood | null {
  const centre = graph.byName.get(name);
  if (!centre) return null;
  const inbound = graph.edges.filter((edge) => edge.to === name);
  const outbound = graph.edges.filter((edge) => edge.from === name);
  return {
    centre,
    dependents: neighbours(
      graph,
      inbound.map(({ from, members }) => ({ name: from, members })),
      area,
    ),
    dependencies: neighbours(
      graph,
      outbound.map(({ to, members }) => ({ name: to, members })),
      area,
    ),
  };
}

/** The entries a search for `query` shows, most depended-on first. */
export function entriesMatching(graph: ArchitectureGraph, filter: EntryFilter): MapEntry[] {
  const wanted = filter.query.trim().toLowerCase();
  return graph.entries.filter(
    (entry) =>
      inArea(entry, filter.area) &&
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
