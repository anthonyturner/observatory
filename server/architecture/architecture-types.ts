/** What a node is, as the map colours and filters it. */
export type NodeKind =
  'service' | 'component' | 'handler' | 'store' | 'token' | 'function' | 'providers';

/** How a class asks Angular for a dependency. */
export type InjectionStyle = 'inject' | 'constructor';

/** What an edge says `from` does with `to`. */
export type EdgeKind = 'injects' | 'uses' | 'provides' | 'extends' | 'calls';

/** The shape this scanner writes; a page reading an older one asks for a rescan. */
export const MAP_SCHEMA = 2;

/** One part of the project, as a ring in the star view and a choice in the area filter. */
export interface ArchitectureArea {
  readonly id: string;
  readonly label: string;
}

/** One class, token, function or provider list. Edges refer to it by `id`. */
export interface ArchitectureNode {
  /** `<file>#<name>`, so two classes of one name in different files stay apart. */
  readonly id: string;
  readonly name: string;
  readonly kind: NodeKind;
  /** Relative to the project's `src/app`, with forward slashes. */
  readonly file: string;
  readonly area: string;
  /** The folder below the area's root, or '' for a file directly in it. */
  readonly group: string;
  readonly providedIn: string | null;
  /** The Overwolf windows whose routed component reaches this node. */
  readonly windows: readonly string[];
}

/** `from` depends on `to` in the way `kind` names; `members` are the ones it reads. */
export interface ArchitectureEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
  /** How an `injects` edge asks for its dependency; null for every other kind. */
  readonly how: InjectionStyle | null;
  readonly members: readonly string[];
}

/** A project's nodes and how they depend on each other, as the scanner writes it and the page reads it. */
export interface ArchitectureMap {
  readonly schema: number;
  readonly project: string;
  readonly scannedAt: string;
  readonly areas: readonly ArchitectureArea[];
  /** Window names from the project's Overwolf manifest; empty when it has none. */
  readonly windows: readonly string[];
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
}
