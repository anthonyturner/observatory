import {
  type ArchitectureEdge,
  type ArchitectureNode,
  type EdgeMark,
  isCodeEdge,
  type NodeMark,
} from './architecture-types.ts';
import { filePair } from './import-links.ts';

/**
 * A node is a hub when it has at least this many code edges. Below that it is
 * merely busy: a small map has no hubs, however its edges are spread.
 */
const HUB_MIN_EDGES = 8;
/** A hub is also among the busiest twentieth of the nodes, so a large map flags only its extremes. */
const HUB_SHARE = 0.95;

/**
 * A file is hot when it changed in at least this many commits within the
 * map's churn window. Fewer is the ordinary upkeep every file gets.
 */
const HOT_MIN_COMMITS = 5;
/** A hot file is also among the most changed twentieth of the nodes. */
const HOT_SHARE = 0.95;

export interface AnalysisInputs {
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
  /** Nodes something starts without an edge to them: routed or bootstrapped components, and the entry files' nodes. */
  readonly entryIds: ReadonlySet<string>;
  /** The runtime each area belongs to, by area id. */
  readonly runtimeOfArea: ReadonlyMap<string, string>;
  /** The pairs of files an import cycle runs through, as `filePair` writes them. */
  readonly cycleFilePairs: ReadonlySet<string>;
  /** The nodes on an import cycle. */
  readonly cycleIds: ReadonlySet<string>;
}

/** The value `share` of the way up the sorted values, at least `floor`. */
function thresholdAt(values: readonly number[], share: number, floor: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.max(0, Math.ceil(sorted.length * share) - 1);
  return Math.max(floor, sorted[at] ?? floor);
}

function countBy(edges: readonly ArchitectureEdge[], end: 'from' | 'to'): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) counts.set(edge[end], (counts.get(edge[end]) ?? 0) + 1);
  return counts;
}

/** The marks an edge earns: on an import cycle, or a code edge between two runtimes. */
function edgeMarksOf(
  edge: ArchitectureEdge,
  nodes: ReadonlyMap<string, ArchitectureNode>,
  inputs: AnalysisInputs,
): EdgeMark[] {
  const [from, to] = [nodes.get(edge.from), nodes.get(edge.to)];
  if (!from || !to || !isCodeEdge(edge)) return [];
  const marks: EdgeMark[] = [];
  if (inputs.cycleFilePairs.has(filePair(from.file, to.file))) marks.push('cycle');
  const runtimes = [from, to].map(({ area }) => inputs.runtimeOfArea.get(area));
  if (runtimes[0] !== runtimes[1]) marks.push('boundary');
  return marks;
}

/**
 * Works out every count and mark the views draw: fan-in and fan-out over code
 * edges, and hub, cycle, unused, boundary and hot on the nodes, cycle and
 * boundary on the edges. The nodes keep the churn they were given.
 */
export function analyse(inputs: AnalysisInputs): {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
} {
  const byId = new Map(inputs.nodes.map((node) => [node.id, node]));
  const edges = inputs.edges.map((edge) => ({ ...edge, marks: edgeMarksOf(edge, byId, inputs) }));
  const code = edges.filter(isCodeEdge);
  const [fanIns, fanOuts] = [countBy(code, 'to'), countBy(code, 'from')];
  const started = new Set([
    ...inputs.entryIds,
    ...edges.filter((edge) => !isCodeEdge(edge)).map(({ to }) => to),
  ]);
  const onBoundary = new Set(
    edges.filter(({ marks }) => marks.includes('boundary')).flatMap(({ from, to }) => [from, to]),
  );
  const degrees = inputs.nodes.map(({ id }) => (fanIns.get(id) ?? 0) + (fanOuts.get(id) ?? 0));
  const hubFrom = thresholdAt(degrees, HUB_SHARE, HUB_MIN_EDGES);
  const hotFrom = thresholdAt(
    inputs.nodes.map(({ metrics }) => metrics.churn),
    HOT_SHARE,
    HOT_MIN_COMMITS,
  );
  const nodes = inputs.nodes.map((node): ArchitectureNode => {
    const fanIn = fanIns.get(node.id) ?? 0;
    const fanOut = fanOuts.get(node.id) ?? 0;
    const isSomewhereStarted =
      started.has(node.id) || node.kind === 'route' || node.kind === 'external';
    const earned: [NodeMark, boolean][] = [
      ['hub', fanIn + fanOut >= hubFrom],
      ['cycle', inputs.cycleIds.has(node.id)],
      ['unused', fanIn === 0 && !isSomewhereStarted],
      ['boundary', onBoundary.has(node.id)],
      ['hot', node.metrics.churn >= hotFrom],
    ];
    return {
      ...node,
      metrics: { ...node.metrics, fanIn, fanOut },
      marks: earned.flatMap(([mark, isEarned]) => (isEarned ? [mark] : [])),
    };
  });
  return { nodes, edges };
}
