import {
  isCodeEdge,
  type ArchitectureEdge,
  type ArchitectureNode,
  type EdgeMark,
  type NodeMark,
} from '../../../server/architecture/architecture-types.ts';
import { pick } from './synthetic-random.ts';

const HUB_SHARE = 0.03;
const HOT_SHARE = 0.05;
const CYCLE_PAIRS = 6;

/** Marks and counts worked out from the edges, so the map keeps the contract's rules. */
export function analysed(
  nodes: readonly ArchitectureNode[],
  drafted: readonly ArchitectureEdge[],
  rand: () => number,
): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; cycles: string[][] } {
  const runtimeOf = new Map(nodes.map((node) => [node.id, node.area.split(':')[0] ?? node.area]));
  const internal = nodes.filter(
    (node) => node.file !== '' && node.kind !== 'route' && node.parent === null,
  );
  const cycles: string[][] = [];
  const backEdges: ArchitectureEdge[] = [];
  const known = new Set(drafted.map((edge) => `${edge.from}>${edge.to}`));
  for (let at = 0; at < CYCLE_PAIRS; at++) {
    const first = pick(internal, rand);
    const second = pick(
      internal.filter((node) => node.area === first?.area),
      rand,
    );
    if (
      !first ||
      !second ||
      first.id === second.id ||
      known.has(`${first.id}>${second.id}`) ||
      known.has(`${second.id}>${first.id}`)
    )
      continue;
    cycles.push([first.id, second.id]);
    known.add(`${first.id}>${second.id}`);
    known.add(`${second.id}>${first.id}`);
    backEdges.push(
      { from: first.id, to: second.id, kind: 'imports', how: null, members: [], marks: ['cycle'] },
      { from: second.id, to: first.id, kind: 'imports', how: null, members: [], marks: ['cycle'] },
    );
  }
  const edges = [...drafted, ...backEdges].map((edge): ArchitectureEdge => {
    const crossing = runtimeOf.get(edge.from) !== runtimeOf.get(edge.to);
    const marks: EdgeMark[] = [
      ...edge.marks,
      ...(crossing && isCodeEdge(edge) ? (['boundary'] as const) : []),
    ];
    return { ...edge, marks };
  });
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const edge of edges.filter(isCodeEdge)) {
    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);
    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
  }
  const degrees = [...nodes]
    .map((node) => (fanIn.get(node.id) ?? 0) + (fanOut.get(node.id) ?? 0))
    .sort((a, b) => b - a);
  const hubFloor = degrees[Math.max(0, Math.floor(nodes.length * HUB_SHARE))] ?? 0;
  const inCycle = new Set(cycles.flat());
  const boundary = new Set(
    edges.filter((edge) => edge.marks.includes('boundary')).flatMap((edge) => [edge.from, edge.to]),
  );
  const marked = nodes.map((node): ArchitectureNode => {
    const into = fanIn.get(node.id) ?? 0;
    const out = fanOut.get(node.id) ?? 0;
    const marks: NodeMark[] = [
      ...(into + out > hubFloor ? (['hub'] as const) : []),
      ...(inCycle.has(node.id) ? (['cycle'] as const) : []),
      ...(into === 0 && node.kind !== 'route' && node.file !== '' ? (['unused'] as const) : []),
      ...(boundary.has(node.id) ? (['boundary'] as const) : []),
      ...(rand() < HOT_SHARE ? (['hot'] as const) : []),
    ];
    return { ...node, metrics: { ...node.metrics, fanIn: into, fanOut: out }, marks };
  });
  return { nodes: marked, edges, cycles };
}
