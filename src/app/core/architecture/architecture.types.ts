/**
 * What a node is, as the map colours and filters it. The scanner also maps
 * plain modules, routes and outside services; this page draws only Angular's.
 */
export const NODE_KINDS = [
  'service',
  'component',
  'handler',
  'store',
  'token',
  'function',
  'providers',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** How a class asks Angular for a dependency. */
export const INJECTION_STYLES = ['inject', 'constructor'] as const;
export type InjectionStyle = (typeof INJECTION_STYLES)[number];

/** What an edge says `from` does with `to`, in the order the page names them. */
export const EDGE_KINDS = ['injects', 'uses', 'provides', 'extends', 'calls'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

/** One part of the mapped project: a ring in the star view, a choice in the area filter. */
export interface ArchitectureArea {
  readonly id: string;
  readonly label: string;
}

/** One class, token, function or provider list. Edges refer to it by `id`. */
export interface ArchitectureNode {
  /** Unique even when two nodes share a name; an old map's ids are the names. */
  readonly id: string;
  readonly name: string;
  readonly kind: NodeKind;
  readonly file: string;
  readonly area: string;
  readonly group: string;
  readonly providedIn: string | null;
  /** The Overwolf windows that pull this node in. */
  readonly windows: readonly string[];
}

/** `from` depends on `to` in the way `kind` names, and reads these members of it. */
export interface ArchitectureEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
  readonly how: InjectionStyle | null;
  readonly members: readonly string[];
}

/** A project's nodes and how they depend on each other, as `GET /api/architecture` serves it. */
export interface ArchitectureMap {
  readonly project: string;
  readonly scannedAt: string;
  readonly areas: readonly ArchitectureArea[];
  readonly windows: readonly string[];
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
}

/** Where the map stands; `missing` is an API that answered but has no clone of the project to scan. */
export type ArchitectureState =
  | { readonly status: 'reading' | 'missing' | 'unreachable' }
  | { readonly status: 'ready'; readonly map: ArchitectureMap };
