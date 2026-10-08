import type {
  EdgeKind,
  NodeKind,
  NodeMark,
  RuntimeKind,
  Visibility,
} from '../../server/architecture/architecture-types.ts';

/**
 * How each kind of thing the map holds looks, in one place for every view and for the
 * legend. Each table is keyed by the contract's own list, so a kind added there fails to
 * compile here until it is given a look.
 */
export interface NodeKindLook {
  readonly badge: string;
  readonly label: string;
  readonly colour: string;
}

export const NODE_KIND_LOOK: Readonly<Record<NodeKind, NodeKindLook>> = {
  service: { badge: 'SVC', label: 'service', colour: '#f0c48a' },
  component: { badge: 'CMP', label: 'component', colour: '#7fe0c8' },
  handler: { badge: 'HDL', label: 'handler', colour: '#ffb648' },
  store: { badge: 'STO', label: 'store', colour: '#a9d8ff' },
  token: { badge: 'TOK', label: 'token', colour: '#d6e07a' },
  function: { badge: 'FN', label: 'function', colour: '#ff9fb2' },
  providers: { badge: 'PRV', label: 'providers', colour: '#9bb1ff' },
  module: { badge: 'MOD', label: 'module', colour: '#c3cbd9' },
  route: { badge: 'API', label: 'route', colour: '#ff8a6a' },
  external: { badge: 'EXT', label: 'outside service', colour: '#d59bff' },
};

export interface EdgeKindLook {
  readonly label: string;
  readonly meaning: string;
  readonly colour: string;
}

export const EDGE_KIND_LOOK: Readonly<Record<EdgeKind, EdgeKindLook>> = {
  injects: { label: 'injects', meaning: 'asks Angular for it', colour: '#5fd4ff' },
  uses: { label: 'uses', meaning: 'renders it in a template', colour: '#b18cff' },
  provides: { label: 'provides', meaning: 'offers it to others', colour: '#6fe39a' },
  extends: { label: 'extends', meaning: 'inherits from it', colour: '#f08bd0' },
  calls: { label: 'calls', meaning: 'calls its code', colour: '#ffb648' },
  imports: { label: 'imports', meaning: 'imports its file', colour: '#8795ad' },
  requests: { label: 'requests', meaning: 'sends it an HTTP request', colour: '#ffe14d' },
  handles: { label: 'handles', meaning: 'is answered by this code', colour: '#ff9a52' },
  reaches: { label: 'reaches', meaning: 'calls an outside web service', colour: '#e0a8ff' },
  spawns: { label: 'spawns', meaning: 'starts it as a program', colour: '#ff6f91' },
};

export interface MarkLook {
  readonly tag: string;
  readonly label: string;
  readonly meaning: string;
  readonly colour: string;
}

export const MARK_LOOK: Readonly<Record<NodeMark, MarkLook>> = {
  hub: { tag: 'HUB', label: 'hub', meaning: 'far more links than most', colour: '#ffe27a' },
  cycle: { tag: 'CYC', label: 'cycle', meaning: 'on an import cycle', colour: '#ff4dd2' },
  unused: { tag: 'UNU', label: 'unused', meaning: 'nothing depends on it', colour: '#8a97ad' },
  boundary: {
    tag: 'BND',
    label: 'boundary',
    meaning: 'crosses between runtimes',
    colour: '#ff9f43',
  },
  hot: { tag: 'HOT', label: 'hot', meaning: 'among the most changed files', colour: '#ff5a5a' },
};

export type IconName = 'monitor' | 'server' | 'terminal' | 'cloud';

export const RUNTIME_ICON: Readonly<Record<RuntimeKind, IconName>> = {
  browser: 'monitor',
  server: 'server',
  program: 'terminal',
  'web-service': 'cloud',
};

export interface IconShape {
  readonly tag: 'rect' | 'path' | 'circle';
  readonly attrs: Readonly<Record<string, string>>;
}

/** Line drawings on a 34 by 34 grid, one per kind of runtime. */
export const ICON_SHAPES: Readonly<Record<IconName, readonly IconShape[]>> = {
  monitor: [
    { tag: 'rect', attrs: { x: '3', y: '5', width: '28', height: '18', rx: '1.5' } },
    { tag: 'path', attrs: { d: 'M13 29h8M17 23v6' } },
    { tag: 'path', attrs: { d: 'M8 11h10M8 15h14M8 19h6', opacity: '.6' } },
  ],
  server: [
    { tag: 'rect', attrs: { x: '5', y: '4', width: '24', height: '8', rx: '1' } },
    { tag: 'rect', attrs: { x: '5', y: '13', width: '24', height: '8', rx: '1' } },
    { tag: 'rect', attrs: { x: '5', y: '22', width: '24', height: '8', rx: '1' } },
    { tag: 'circle', attrs: { cx: '10', cy: '8', r: '1.2', fill: 'currentColor' } },
    { tag: 'circle', attrs: { cx: '10', cy: '17', r: '1.2', fill: 'currentColor' } },
    { tag: 'circle', attrs: { cx: '10', cy: '26', r: '1.2', fill: 'currentColor' } },
    { tag: 'path', attrs: { d: 'M16 8h9M16 17h9M16 26h9', opacity: '.5' } },
  ],
  terminal: [
    { tag: 'rect', attrs: { x: '3', y: '6', width: '28', height: '22', rx: '1.5' } },
    { tag: 'path', attrs: { d: 'M3 11h28', opacity: '.5' } },
    { tag: 'path', attrs: { d: 'M8 17l4 3-4 3M15 23h7' } },
  ],
  cloud: [
    { tag: 'path', attrs: { d: 'M10 25h15a6 6 0 0 0 0-12 8 8 0 0 0-15-2 6.5 6.5 0 0 0 0 14z' } },
    { tag: 'path', attrs: { d: 'M12 29v2M17 29v3M22 29v2', opacity: '.6' } },
  ],
};

/** The UML sign for each visibility. */
export const VISIBILITY_SIGN: Readonly<Record<Visibility, string>> = {
  public: '+',
  protected: '#',
  private: '-',
};
