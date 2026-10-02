import { basename, resolve } from 'node:path';
import { localSetting } from '../util/local-setting.ts';
import { AREA_RULES } from './area-rules.ts';
import { ARCHITECTURE_FILE, writeArchitecture } from './architecture-file.ts';
import { architectureMap } from './architecture-map.ts';
import type { ArchitectureMap } from './architecture-types.ts';
import { manifestWindows, projectAliases, scannedFiles } from './project-source.ts';

/** The setting that names the project to map when no folder is given on the command line. */
const SOURCE_SETTING = 'OBSERVATORY_ARCH_SOURCE';

const source = process.argv[2] ?? localSetting(SOURCE_SETTING);
if (!source) {
  console.error(
    `Which project? Pass its folder (npm run arch:scan -- <folder>) or set ${SOURCE_SETTING}.`,
  );
  process.exit(1);
}

/** Counts only, never names: the mapped project may be private. */
function summaryOf({ nodes, edges, windows }: ArchitectureMap): string {
  const byKind = new Map<string, number>();
  for (const { kind } of edges) byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  const kinds = [...byKind].map(([kind, count]) => `${count} ${kind}`).join(', ');
  const hosting = windows.filter((window) => nodes.some((node) => node.windows.includes(window)));
  return [
    `Mapped ${nodes.length} nodes and ${edges.length} edges (${kinds}).`,
    `${hosting.length} of ${windows.length} windows host something.`,
  ].join(' ');
}

const projectRoot = resolve(source);
const map = architectureMap({
  project: basename(projectRoot),
  scannedAt: new Date().toISOString(),
  windows: await manifestWindows(projectRoot),
  rules: AREA_RULES,
  files: await scannedFiles(projectRoot),
  aliases: await projectAliases(projectRoot),
});
await writeArchitecture(map);
console.log(`${summaryOf(map)} Written to ${ARCHITECTURE_FILE}`);
