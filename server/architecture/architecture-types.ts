/** What a class is, as the map colours and filters it. */
export type NodeKind = 'service' | 'component' | 'handler' | 'store';

/** How a class asks Angular for a dependency. */
export type InjectionStyle = 'inject' | 'constructor';

/** One part of the project, as a ring in the star view and a choice in the area filter. */
export interface ArchitectureArea {
  readonly id: string;
  readonly label: string;
}

/** One Angular class. Its name is its identity: edges refer to it by name. */
export interface ArchitectureNode {
  readonly name: string;
  readonly kind: NodeKind;
  /** Relative to the project's `src/app`, with forward slashes. */
  readonly file: string;
  readonly area: string;
  /** The folder below the area's root, or '' for a file directly in it. */
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

/** A project's classes and what injects what, as the scanner writes it and the page reads it. */
export interface ArchitectureMap {
  readonly project: string;
  readonly scannedAt: string;
  readonly areas: readonly ArchitectureArea[];
  /** Window names from the project's Overwolf manifest; empty when it has none. */
  readonly windows: readonly string[];
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
}
