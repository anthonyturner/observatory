import type { ArchitectureEdge } from './architecture-types.ts';
import { nodeId, type ReferenceResolver } from './reference-resolver.ts';
import type { ScannedDeclaration, ScannedFile } from './scanned-source.ts';

export interface EdgeInputs {
  readonly files: readonly ScannedFile[];
  /** The ids of the mapped nodes; a declaration outside them has no edges. */
  readonly ids: ReadonlySet<string>;
  readonly resolver: ReferenceResolver;
}

const link = (from: string, to: string, kind: ArchitectureEdge['kind']): ArchitectureEdge => ({
  from,
  to,
  kind,
  how: null,
  members: [],
  marks: [],
});

function referenceEdges(
  file: string,
  declaration: ScannedDeclaration,
  resolver: ReferenceResolver,
): ArchitectureEdge[] {
  const from = nodeId(file, declaration.name);
  return declaration.references.flatMap(({ target, kind, how, members }) => {
    const to = resolver.named(file, target);
    return to === null ? [] : [{ from, to, kind, how, members, marks: [] }];
  });
}

/** `{ provide: T, useClass: C }`: the token hands out the class, so T provides C. */
function bindingEdges(
  { file, bindings }: ScannedFile,
  resolver: ReferenceResolver,
): ArchitectureEdge[] {
  return bindings.flatMap(({ token, target }) => {
    const [from, to] = [resolver.named(file, token), resolver.named(file, target)];
    return from === null || to === null ? [] : [link(from, to, 'provides')];
  });
}

/** Each element selector, with the components that claim it. */
function claimsOf(files: readonly ScannedFile[]): Map<string, string[]> {
  const claims = new Map<string, string[]>();
  for (const { file, declarations } of files) {
    for (const { name, element } of declarations) {
      if (element) claims.set(element, [...(claims.get(element) ?? []), nodeId(file, name)]);
    }
  }
  return claims;
}

/** A tag in a template uses the one component claiming it; a tag two claim is left out. */
function templateEdges(
  file: string,
  declaration: ScannedDeclaration,
  claims: ReadonlyMap<string, string[]>,
): ArchitectureEdge[] {
  const from = nodeId(file, declaration.name);
  return declaration.tags.flatMap((tag) => {
    const [to, ...others] = claims.get(tag) ?? [];
    return to && others.length === 0 ? [link(from, to, 'uses')] : [];
  });
}

/** Every use a template makes of a component, between two mapped nodes and never of a node by itself. */
export function templateUses(
  files: readonly ScannedFile[],
  ids: ReadonlySet<string>,
): ArchitectureEdge[] {
  const claims = claimsOf(files);
  return files
    .flatMap(({ file, declarations }) =>
      declarations.flatMap((declaration) => templateEdges(file, declaration, claims)),
    )
    .filter(({ from, to }) => from !== to && ids.has(from) && ids.has(to));
}

/** For each component rendered by the template of exactly one other, that other. */
export function parentsOf(uses: readonly ArchitectureEdge[]): Map<string, string> {
  const renderers = new Map<string, Set<string>>();
  for (const { from, to } of uses)
    renderers.set(to, (renderers.get(to) ?? new Set<string>()).add(from));
  return new Map(
    [...renderers].flatMap(([child, parents]): [string, string][] => {
      const [parent] = parents;
      return parent !== undefined && parents.size === 1 ? [[child, parent]] : [];
    }),
  );
}

/** One edge per pair and kind, with the members of every duplicate merged in. */
function merged(edges: readonly ArchitectureEdge[]): ArchitectureEdge[] {
  const byKey = new Map<string, ArchitectureEdge>();
  for (const edge of edges) {
    const key = `${edge.from}>${edge.to}>${edge.kind}`;
    const earlier = byKey.get(key);
    const members = [...new Set([...(earlier?.members ?? []), ...edge.members])].sort();
    byKey.set(key, { ...edge, how: earlier?.how ?? edge.how, members });
  }
  return [...byKey.values()];
}

/** Every edge between two mapped nodes, never from a node to itself. */
export function edgesOf({ files, ids, resolver }: EdgeInputs): ArchitectureEdge[] {
  const edges = [
    ...files.flatMap((scanned) => [
      ...scanned.declarations
        .filter(({ name }) => ids.has(nodeId(scanned.file, name)))
        .flatMap((declaration) => referenceEdges(scanned.file, declaration, resolver)),
      ...bindingEdges(scanned, resolver),
    ]),
    ...templateUses(files, ids),
  ];
  return merged(edges.filter(({ from, to }) => from !== to && ids.has(from) && ids.has(to)));
}
