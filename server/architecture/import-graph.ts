import { join } from 'node:path';
import { cruise, type IModule } from 'dependency-cruiser';
import extractTsConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { jsonObjectOf, SKIPPED_SUFFIXES } from './project-files.ts';
import { byText } from './sort-order.ts';

/** One file importing another. */
export interface FileImport {
  readonly from: string;
  readonly to: string;
}

/** How the project's files import each other, as dependency-cruiser finds it. */
export interface ImportGraph {
  readonly imports: readonly FileImport[];
  /** Each import cycle as the files around it, in order, from its smallest path, with no file repeated. */
  readonly cycles: readonly (readonly string[])[];
  /** Files that import nothing and that nothing imports. */
  readonly orphans: readonly string[];
}

const NODE_MODULES = 'node_modules';
const CIRCULAR_RULE = 'no-circular';
const ORPHAN_RULE = 'no-orphans';
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/** A pattern for the files the scan leaves out, so the graph holds the same files the map does. */
const SKIPPED = `(${SKIPPED_SUFFIXES.map((suffix) => suffix.replace(REGEX_SPECIALS, '\\$&')).join('|')})$`;

/** `cycle` starting from its smallest path, so one cycle is one list however it was found. */
function rotated(cycle: readonly string[]): string[] {
  const smallest = cycle.reduce((best, file) => (file < best ? file : best));
  const at = cycle.indexOf(smallest);
  return [...cycle.slice(at), ...cycle.slice(0, at)];
}

const isProjectFile = ({
  resolved,
  coreModule,
  couldNotResolve,
}: IModule['dependencies'][number]) =>
  !coreModule && !couldNotResolve && !resolved.split('/').includes(NODE_MODULES);

/**
 * The import graph of `files`, paths from the project root, and of whatever
 * they import within the project. dependency-cruiser resolves each import the
 * way TypeScript does, through `tsconfig.json` paths, folder indexes and
 * explicit extensions alike. Type-only imports count, as they couple files
 * all the same. It lists, for every import on a cycle, one cycle through it.
 */
export async function importGraphOf(
  projectRoot: string,
  files: readonly string[],
): Promise<ImportGraph> {
  const tsconfig =
    (await jsonObjectOf(projectRoot, 'tsconfig.json')) === null
      ? null
      : join(projectRoot, 'tsconfig.json');
  const { output } = await cruise(
    [...files],
    {
      baseDir: projectRoot,
      tsPreCompilationDeps: true,
      exclude: { path: [SKIPPED, NODE_MODULES] },
      doNotFollow: { path: NODE_MODULES },
      ruleSet: {
        forbidden: [
          { name: CIRCULAR_RULE, severity: 'info', from: {}, to: { circular: true } },
          { name: ORPHAN_RULE, severity: 'info', from: { orphan: true }, to: {} },
        ],
      },
      ...(tsconfig === null ? {} : { tsConfig: { fileName: tsconfig } }),
    },
    {},
    // The paths of a tsconfig reach the resolver only through its parsed form.
    tsconfig === null ? {} : { tsConfig: extractTsConfig(tsconfig) },
  );
  if (typeof output === 'string') throw new Error('dependency-cruiser gave text, not a result.');
  const imports = output.modules.flatMap((module) =>
    module.dependencies
      .filter(isProjectFile)
      .filter(({ resolved }) => resolved !== module.source)
      .map(({ resolved }): FileImport => ({ from: module.source, to: resolved })),
  );
  const cycles = output.modules.flatMap((module) =>
    module.dependencies.flatMap(({ circular, cycle }) =>
      circular && cycle ? [rotated(cycle.map(({ name }) => name))] : [],
    ),
  );
  const unique = new Map(cycles.map((cycle) => [cycle.join('\n'), cycle]));
  const key = ({ from, to }: FileImport): string => `${from}\n${to}`;
  return {
    imports: [...new Map(imports.map((each) => [key(each), each]))]
      .sort(([a], [b]) => byText(a, b))
      .map(([, each]) => each),
    cycles: [...unique].sort(([a], [b]) => byText(a, b)).map(([, cycle]) => cycle),
    orphans: output.modules
      .filter(({ orphan }) => orphan === true)
      .map(({ source }) => source)
      .sort(byText),
  };
}
