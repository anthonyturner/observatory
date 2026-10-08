import {
  type ArchitectureEdge,
  type ArchitectureMap,
  type ArchitectureNode,
  isCodeEdge,
} from './architecture-types.ts';

const count = (edges: readonly ArchitectureEdge[], end: 'from' | 'to', id: string): number =>
  edges.filter((edge) => edge[end] === id).length;

/** Where a node breaks a rule the views rely on, as one line per break. */
function nodeProblems(
  node: ArchitectureNode,
  map: ArchitectureMap,
  ids: ReadonlyMap<string, ArchitectureNode>,
  code: readonly ArchitectureEdge[],
): string[] {
  const { id, area, parent, kind, endpoint, metrics, marks } = node;
  const touching = map.edges.filter((edge) => edge.from === id || edge.to === id);
  const checks: [boolean, string][] = [
    [map.areas.some((each) => each.id === area), `${id}: unknown area ${area}`],
    [
      parent === null || ids.get(parent)?.kind === 'component',
      `${id}: parent ${parent} is not a component`,
    ],
    [(kind === 'route') === (endpoint !== null), `${id}: only a route has an endpoint`],
    [
      metrics.fanIn === count(code, 'to', id),
      `${id}: fanIn ${metrics.fanIn} is not its code edges in`,
    ],
    [
      metrics.fanOut === count(code, 'from', id),
      `${id}: fanOut ${metrics.fanOut} is not its code edges out`,
    ],
    [
      !marks.includes('unused') || metrics.fanIn === 0,
      `${id}: unused, yet something depends on it`,
    ],
    [
      marks.includes('boundary') === touching.some((edge) => edge.marks.includes('boundary')),
      `${id}: boundary mark disagrees with its edges`,
    ],
    [
      marks.includes('cycle') === map.cycles.some((cycle) => cycle.includes(id)),
      `${id}: cycle mark disagrees with the cycles`,
    ],
  ];
  return checks.flatMap(([holds, problem]) => (holds ? [] : [problem]));
}

/**
 * Every way `map` breaks the contract beyond its types: edges to nowhere,
 * counts and marks that disagree with the edges. Empty for a sound map.
 */
export function mapProblems(map: ArchitectureMap): string[] {
  const ids = new Map(map.nodes.map((node) => [node.id, node]));
  const runtimes = new Set(map.runtimes.map(({ id }) => id));
  const code = map.edges.filter(isCodeEdge);
  return [
    ...map.areas
      .filter(({ runtime }) => !runtimes.has(runtime))
      .map(({ id, runtime }) => `${id}: unknown runtime ${runtime}`),
    ...map.edges
      .filter(({ from, to }) => !ids.has(from) || !ids.has(to))
      .map(({ from, to, kind }) => `${from} ${kind} ${to}: an end is not a node`),
    ...map.cycles
      .flat()
      .filter((id) => !ids.has(id))
      .map((id) => `cycle names unknown node ${id}`),
    ...map.nodes.flatMap((node) => nodeProblems(node, map, ids, code)),
  ];
}
