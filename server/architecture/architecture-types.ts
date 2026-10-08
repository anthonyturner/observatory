/**
 * The architecture map's JSON shape: what the scanner writes and every view reads.
 *
 * The map nests four deep: a runtime holds areas, an area holds nodes, and a node
 * may hold child nodes (`parent`) and members. Edges link any two nodes. Every
 * analysis result is worked out by the scanner, so the views only draw it.
 */

/** What a node is, as the views colour and filter it. */
export const NODE_KINDS = [
  'service',
  'component',
  'handler',
  'store',
  'token',
  'function',
  'providers',
  /** A source file with no Angular declaration, mapped whole, as most API server code is. */
  'module',
  /** One endpoint the API server answers: its method and path are in `endpoint`. */
  'route',
  /** Something outside the project that its code reaches over the network or starts. */
  'external',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** How a class asks Angular for a dependency. */
export type InjectionStyle = 'inject' | 'constructor';

/** What an edge says `from` does with `to`. */
export const EDGE_KINDS = [
  'injects',
  'uses',
  'provides',
  'extends',
  'calls',
  /** An import between two nodes' files that no richer kind above explains. */
  'imports',
  /** `from` sends an HTTP request that `to`, a route, answers. */
  'requests',
  /** `from`, a route, is answered by `to`, the code behind it. */
  'handles',
  /** `from` calls `to`, an outside web service, over the network. */
  'reaches',
  /** `from` starts `to`, an outside program, as a child process. */
  'spawns',
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

/** The edges that carry a request at run time; every other kind is a code dependency. */
export const FLOW_EDGE_KINDS: readonly EdgeKind[] = ['requests', 'handles', 'reaches', 'spawns'];

/** Whether an edge is a code dependency, which fan-in, fan-out and cycles count, rather than a flow. */
export const isCodeEdge = ({ kind }: { readonly kind: EdgeKind }): boolean =>
  !FLOW_EDGE_KINDS.includes(kind);

/** The shape this scanner writes; a page reading an older one asks for a rescan. */
export const MAP_SCHEMA = 3;

/**
 * Where code runs: the browser app, the API server, or, outside the project, the
 * web services it calls and the programs it starts.
 */
export const RUNTIME_KINDS = ['browser', 'server', 'web-service', 'program'] as const;
export type RuntimeKind = (typeof RUNTIME_KINDS)[number];

/** One machine or process the app runs across: a rig in the Circuit view. */
export interface ArchitectureRuntime {
  readonly id: string;
  readonly label: string;
  readonly kind: RuntimeKind;
  /** The folder its source lives in, relative to the project root; '' outside the project. */
  readonly root: string;
}

/** One part of a runtime, from one folder: a bay in the Circuit view, a star system in the Star map. */
export interface ArchitectureArea {
  /** Unique across runtimes. */
  readonly id: string;
  readonly label: string;
  readonly runtime: string;
  /** Relative to the project root, with forward slashes; '' for an outside runtime's one area. */
  readonly folder: string;
}

/** What a member of a class or module is. */
export const MEMBER_KINDS = [
  'method',
  'property',
  'accessor',
  'signal',
  'input',
  'output',
  'export',
] as const;
export type MemberKind = (typeof MEMBER_KINDS)[number];

export type Visibility = 'public' | 'protected' | 'private';

/** One member, as the UML card lists it and the deepest zoom level shows it. */
export interface ArchitectureMember {
  readonly name: string;
  readonly kind: MemberKind;
  readonly visibility: Visibility;
}

/** An API route's method and path, such as `GET` and `/api/queue`. */
export interface Endpoint {
  readonly method: string;
  readonly path: string;
}

/** Counts the views size and shade a node by. */
export interface NodeMetrics {
  /** Code edges into this node. */
  readonly fanIn: number;
  /** Code edges out of this node. */
  readonly fanOut: number;
  /** Commits that touched its file within the map's `churnDays`; 0 outside a git checkout. */
  readonly churn: number;
}

/**
 * What analysis found about a node:
 * - `hub`: far more code edges than most nodes;
 * - `cycle`: its file is on an import cycle;
 * - `unused`: nothing depends on it and nothing starts it (a route, a routed or bootstrapped class);
 * - `boundary`: it has an edge marked `boundary`;
 * - `hot`: among the most often changed files.
 */
export const NODE_MARKS = ['hub', 'cycle', 'unused', 'boundary', 'hot'] as const;
export type NodeMark = (typeof NODE_MARKS)[number];

/** What analysis found about an edge: on an import cycle, or a code edge between two runtimes. */
export const EDGE_MARKS = ['cycle', 'boundary'] as const;
export type EdgeMark = (typeof EDGE_MARKS)[number];

/** One class, token, function, provider list, module, route or outside service. Edges refer to it by `id`. */
export interface ArchitectureNode {
  /**
   * `<file>#<name>`, so two classes of one name in different files stay apart;
   * a module's is its file, a route's `route:<METHOD> <path>`, an outside one's `external:<name>`.
   */
  readonly id: string;
  readonly name: string;
  readonly kind: NodeKind;
  /** Relative to the project root, with forward slashes; '' for an outside node. */
  readonly file: string;
  readonly area: string;
  /** The folder below the area's folder, or '' for a file directly in it. */
  readonly group: string;
  readonly providedIn: string | null;
  /** The Overwolf windows whose routed component reaches this node. */
  readonly windows: readonly string[];
  /** The one component whose template alone renders this one, which shows it as a child; else null. */
  readonly parent: string | null;
  readonly members: readonly ArchitectureMember[];
  /** Set on a route; null on every other kind. */
  readonly endpoint: Endpoint | null;
  /** Lines of code in its file, blank and comment lines left out; 0 for an outside node. */
  readonly loc: number;
  readonly metrics: NodeMetrics;
  readonly marks: readonly NodeMark[];
}

/** `from` depends on `to` in the way `kind` names; `members` are the ones it reads. */
export interface ArchitectureEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: EdgeKind;
  /** How an `injects` edge asks for its dependency; null for every other kind. */
  readonly how: InjectionStyle | null;
  readonly members: readonly string[];
  readonly marks: readonly EdgeMark[];
}

/** A project's nodes and how they depend on each other, as the scanner writes it and the views read it. */
export interface ArchitectureMap {
  readonly schema: number;
  readonly project: string;
  readonly scannedAt: string;
  /** How many days back `churn` counts; 0 when the project is not a git checkout. */
  readonly churnDays: number;
  readonly runtimes: readonly ArchitectureRuntime[];
  readonly areas: readonly ArchitectureArea[];
  /** Window names from the project's Overwolf manifest; empty when it has none. */
  readonly windows: readonly string[];
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
  /** Each import cycle, as the ids of the nodes around it, in order. */
  readonly cycles: readonly (readonly string[])[];
}
