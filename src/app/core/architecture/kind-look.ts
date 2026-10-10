import { ArchitectureMap, EDGE_KINDS, EdgeKind, NODE_KINDS, NodeKind } from './architecture.types';

/**
 * What the page calls each kind of node, keyed by the scanner's own list so a kind it adds
 * fails to compile here. Colour and shape are in the views' stylesheets, keyed the same way.
 */
export const NODE_KIND_LABEL: Readonly<Record<NodeKind, string>> = {
  service: 'service',
  component: 'component',
  handler: 'handler',
  store: 'store',
  token: 'token',
  function: 'function',
  providers: 'providers',
  module: 'module',
  route: 'route',
  external: 'outside service',
};

/** What an edge of each kind says its `from` does with its `to`, for the legend. */
export const EDGE_KIND_MEANING: Readonly<Record<EdgeKind, string>> = {
  injects: 'asks Angular for it',
  uses: 'renders it in a template',
  provides: 'offers it to others',
  extends: 'inherits from it',
  calls: 'calls its code',
  imports: 'imports its file',
  requests: 'sends it an HTTP request',
  handles: 'is answered by this code',
  reaches: 'calls an outside web service',
  spawns: 'starts it as a program',
};

export interface Legend {
  /** The kinds of node the map holds, in the scanner's order. */
  readonly nodes: readonly { readonly kind: NodeKind; readonly label: string }[];
  /** The kinds of link the map holds, in the scanner's order. */
  readonly links: readonly { readonly kind: EdgeKind; readonly meaning: string }[];
}

/** The legend for a map: only the kinds it holds, so a project with no Angular code is not told about injection. */
export function legendOf({ nodes, edges }: ArchitectureMap): Legend {
  const [nodeKinds, linkKinds] = [
    new Set(nodes.map((n) => n.kind)),
    new Set(edges.map((e) => e.kind)),
  ];
  return {
    nodes: NODE_KINDS.filter((kind) => nodeKinds.has(kind)).map((kind) => ({
      kind,
      label: NODE_KIND_LABEL[kind],
    })),
    links: EDGE_KINDS.filter((kind) => linkKinds.has(kind)).map((kind) => ({
      kind,
      meaning: EDGE_KIND_MEANING[kind],
    })),
  };
}
