/** What a class is, as the map colours and filters it. */
export const NODE_KINDS = ['service', 'component', 'handler', 'store'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** How a class asks Angular for a dependency. */
export const INJECTION_STYLES = ['inject', 'constructor'] as const;
export type InjectionStyle = (typeof INJECTION_STYLES)[number];

/** One part of the mapped project: a ring in the star view, a choice in the area filter. */
export interface ArchitectureArea {
  readonly id: string;
  readonly label: string;
}

/** One Angular class. Its name is its identity: edges refer to it by name. */
export interface ArchitectureNode {
  readonly name: string;
  readonly kind: NodeKind;
  readonly file: string;
  readonly area: string;
  readonly group: string;
  readonly providedIn: string | null;
}

/** `from` injects `to`, and reads these members of it. */
export interface ArchitectureEdge {
  readonly from: string;
  readonly to: string;
  readonly how: InjectionStyle;
  readonly members: readonly string[];
}

/** A project's classes and what injects what, as `npm run arch:scan` writes it. */
export interface ArchitectureMap {
  readonly project: string;
  readonly scannedAt: string;
  readonly areas: readonly ArchitectureArea[];
  readonly windows: readonly string[];
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
}

/** Where the map stands; `missing` is an API that answered but has no map to give. */
export type ArchitectureState =
  | { readonly status: 'reading' | 'missing' | 'unreachable' }
  | { readonly status: 'ready'; readonly map: ArchitectureMap };
