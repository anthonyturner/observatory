import {
  ArchitectureEdge,
  ArchitectureMap,
  ArchitectureNode,
  EDGE_KINDS,
  NODE_KINDS,
} from './architecture.types';
import { EDGE_KIND_MEANING, NODE_KIND_LABEL, legendOf } from './kind-look';

describe('the kind tables', () => {
  it('word every kind the scanner can write, and no other', () => {
    expect(Object.keys(NODE_KIND_LABEL).sort()).toEqual([...NODE_KINDS].sort());
    expect(Object.keys(EDGE_KIND_MEANING).sort()).toEqual([...EDGE_KINDS].sort());
  });
});

describe('legendOf', () => {
  const node = (kind: ArchitectureNode['kind']): ArchitectureNode => ({
    id: kind,
    name: kind,
    kind,
    file: '',
    area: 'a',
    group: '',
    providedIn: null,
    windows: [],
    marks: [],
    endpoint: null,
  });
  const link = (kind: ArchitectureEdge['kind']): ArchitectureEdge => ({
    from: 'route',
    to: 'module',
    kind,
    how: null,
    members: [],
  });
  const mapOf = (nodes: ArchitectureNode[], edges: ArchitectureEdge[]): ArchitectureMap => ({
    project: '',
    scannedAt: '',
    runtimes: [],
    areas: [],
    windows: [],
    nodes,
    edges,
  });

  it('lists only the kinds the map holds, in the scanner order', () => {
    const legend = legendOf(
      mapOf(
        [node('external'), node('module'), node('route')],
        [link('spawns'), link('requests'), link('requests')],
      ),
    );
    expect(legend.nodes).toEqual([
      { kind: 'module', label: 'module' },
      { kind: 'route', label: 'route' },
      { kind: 'external', label: 'outside service' },
    ]);
    expect(legend.links.map((item) => item.kind)).toEqual(['requests', 'spawns']);
  });

  it('is empty for an empty map', () => {
    expect(legendOf(mapOf([], []))).toEqual({ nodes: [], links: [] });
  });
});
