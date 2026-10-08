import { areaLayoutOf } from './area-layout.ts';
import type {
  ArchitectureArea,
  ArchitectureMember,
  ArchitectureNode,
  ArchitectureRuntime,
  NodeKind,
} from './architecture-types.ts';
import { serviceOfImport } from './network-sdks.ts';
import { nodeId } from './reference-resolver.ts';
import type { DeclarationSort, ScannedDeclaration, ScannedFile } from './scanned-source.ts';

/** Where a file's nodes sit: the runtime it belongs to, and its area and group. */
export interface Placement {
  readonly runtime: ArchitectureRuntime;
  readonly area: string;
  readonly group: string;
}

/** What the nodes of the files need to be built: where each file sits, how often it changed, and which are on an import cycle or in no import at all. */
export interface NodeContext {
  readonly placements: ReadonlyMap<string, Placement>;
  readonly churn: ReadonlyMap<string, number>;
  readonly cycleFiles: ReadonlySet<string>;
  readonly orphanFiles: ReadonlySet<string>;
}

const HANDLER_NAME = /Handler/;
const STORE_NAME = /Store/;
const TS_EXTENSION = /\.ts$/;

/** The kind of every sort but `Injectable`, whose kind its name decides. */
const KIND_OF_SORT: Readonly<Record<Exclude<DeclarationSort, 'Injectable'>, NodeKind>> = {
  Component: 'component',
  Directive: 'component',
  Pipe: 'component',
  InjectionToken: 'token',
  function: 'function',
  providers: 'providers',
};

function kindOf({ sort, name }: ScannedDeclaration): NodeKind {
  if (sort !== 'Injectable') return KIND_OF_SORT[sort];
  if (HANDLER_NAME.test(name)) return 'handler';
  return STORE_NAME.test(name) ? 'store' : 'service';
}

/** A node with nothing known about it beyond what `fields` say: no parent, no marks, no counts. */
export function newNode(
  fields: Pick<ArchitectureNode, 'id' | 'name' | 'kind' | 'file' | 'area' | 'group'> &
    Partial<ArchitectureNode>,
): ArchitectureNode {
  const { id, name, kind, file, area, group, ...rest } = fields;
  return {
    id,
    name,
    kind,
    file,
    area,
    group,
    providedIn: null,
    windows: [],
    parent: null,
    members: [],
    endpoint: null,
    loc: 0,
    metrics: { fanIn: 0, fanOut: 0, churn: 0 },
    marks: [],
    ...rest,
  };
}

/** Every area and the placement of every scanned file that sits under a runtime's root. */
export function placementsOf(
  runtimes: readonly ArchitectureRuntime[],
  files: readonly ScannedFile[],
): { placements: Map<string, Placement>; areas: ArchitectureArea[] } {
  const placements = new Map<string, Placement>();
  const areas: ArchitectureArea[] = [];
  for (const runtime of runtimes) {
    const inside = files
      .map(({ file }) => file)
      .filter((file) => file.startsWith(`${runtime.root}/`));
    const layout = areaLayoutOf(runtime, inside);
    areas.push(...layout.areas);
    for (const file of inside) placements.set(file, { runtime, ...layout.placeOf(file) });
  }
  return { placements, areas };
}

/** The calls out of the process that a file makes, by HTTP, by starting a program or through a network package. */
export const reachesOutside = ({ outbound, specifiers }: ScannedFile): boolean =>
  outbound.length > 0 || specifiers.some((specifier) => serviceOfImport(specifier) !== null);

/**
 * Whether a file with no Angular declaration is a node of its own: every file
 * of the API server is, since most of its code is plain modules. So is any
 * other file that reaches outside the process, since showing that is what the
 * map is for, any on an import cycle, which would otherwise run through a gap
 * with no node to hang the cycle on, and any no file imports and that imports
 * nothing, which is dead code the map should show.
 */
function isModule(scanned: ScannedFile, { runtime }: Placement, context: NodeContext): boolean {
  return (
    runtime.kind === 'server' ||
    reachesOutside(scanned) ||
    context.cycleFiles.has(scanned.file) ||
    context.orphanFiles.has(scanned.file)
  );
}

function declaredNodes(
  scanned: ScannedFile,
  place: Placement,
  context: NodeContext,
): ArchitectureNode[] {
  const { file, loc } = scanned;
  const nodes = new Map<string, ArchitectureNode>();
  for (const declaration of scanned.declarations) {
    const id = nodeId(file, declaration.name);
    if (nodes.has(id)) continue;
    nodes.set(
      id,
      newNode({
        id,
        name: declaration.name,
        kind: kindOf(declaration),
        file,
        area: place.area,
        group: place.group,
        providedIn: declaration.providedIn,
        members: declaration.members,
        loc,
        metrics: { fanIn: 0, fanOut: 0, churn: context.churn.get(file) ?? 0 },
      }),
    );
  }
  return [...nodes.values()];
}

const exportMember = (name: string): ArchitectureMember => ({
  name,
  kind: 'export',
  visibility: 'public',
});

function moduleNode(
  scanned: ScannedFile,
  place: Placement,
  context: NodeContext,
): ArchitectureNode {
  const { file, loc, exports } = scanned;
  return newNode({
    id: file,
    name: file.slice(file.lastIndexOf('/') + 1).replace(TS_EXTENSION, ''),
    kind: 'module',
    file,
    area: place.area,
    group: place.group,
    members: exports.map(exportMember),
    loc,
    metrics: { fanIn: 0, fanOut: 0, churn: context.churn.get(file) ?? 0 },
  });
}

/**
 * The nodes of every scanned file under a runtime, grouped by file and in the
 * order each file declares them: one per Angular declaration, else one module
 * node for the whole file when it is one (see `isModule`).
 */
export function fileNodes(
  files: readonly ScannedFile[],
  context: NodeContext,
): Map<string, ArchitectureNode[]> {
  const byFile = new Map<string, ArchitectureNode[]>();
  for (const scanned of files) {
    const place = context.placements.get(scanned.file);
    if (!place) continue;
    const declared = declaredNodes(scanned, place, context);
    if (declared.length > 0) byFile.set(scanned.file, declared);
    else if (isModule(scanned, place, context))
      byFile.set(scanned.file, [moduleNode(scanned, place, context)]);
  }
  return byFile;
}
