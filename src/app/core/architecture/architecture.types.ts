import type {
  ArchitectureArea as ScannedArea,
  ArchitectureEdge as ScannedEdge,
  ArchitectureNode as ScannedNode,
  ArchitectureRuntime as ScannedRuntime,
} from '../../../../server/architecture/architecture-types';

/**
 * The scanner's own kind lists and types, so a kind it adds is a compile error here
 * until the page gives it a look, not a node the page silently drops.
 */
export {
  EDGE_KINDS,
  INJECTION_STYLES,
  NODE_KINDS,
  NODE_MARKS,
} from '../../../../server/architecture/architecture-types';
export type {
  EdgeKind,
  InjectionStyle,
  NodeKind,
  NodeMark,
} from '../../../../server/architecture/architecture-types';

/** One machine or process the project runs across: the browser app, the API server, an outside service. */
export type ArchitectureRuntime = Pick<ScannedRuntime, 'id' | 'label'>;

/** One part of the mapped project: a ring in the star view, a choice in the area filter. */
export type ArchitectureArea = Pick<ScannedArea, 'id' | 'label' | 'runtime'>;

/** One class, module, route or outside service. Edges refer to it by `id`. */
export type ArchitectureNode = Pick<
  ScannedNode,
  | 'id'
  | 'name'
  | 'kind'
  | 'file'
  | 'area'
  | 'group'
  | 'providedIn'
  | 'windows'
  | 'marks'
  | 'endpoint'
>;

/** `from` depends on, requests, handles or reaches `to` in the way `kind` names, and reads these members of it. */
export type ArchitectureEdge = Pick<ScannedEdge, 'from' | 'to' | 'kind' | 'how' | 'members'>;

/** A project's nodes and how they join, as `GET /api/architecture` serves it. */
export interface ArchitectureMap {
  readonly project: string;
  readonly scannedAt: string;
  readonly runtimes: readonly ArchitectureRuntime[];
  readonly areas: readonly ArchitectureArea[];
  readonly windows: readonly string[];
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
}

/** Where the map stands; `missing` is an API that answered but has no clone of the project to scan. */
export type ArchitectureState =
  | { readonly status: 'reading' | 'missing' | 'unreachable' }
  | { readonly status: 'ready'; readonly map: ArchitectureMap };
