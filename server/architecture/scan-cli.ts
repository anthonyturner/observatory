import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { localSetting } from '../util/local-setting.ts';
import { ARCHITECTURE_FILE, writeArchitecture } from './architecture-file.ts';
import type { ArchitectureMap } from './architecture-types.ts';
import { scanProject } from './scan-project.ts';

/** The setting that names the project to map when no folder is given on the command line. */
const SOURCE_SETTING = 'OBSERVATORY_ARCH_SOURCE';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    'server-root': { type: 'string' },
    'browser-root': { type: 'string' },
  },
});

const source = positionals[0] ?? localSetting(SOURCE_SETTING);
if (!source) {
  console.error(
    `Which project? Pass its folder (npm run arch:scan -- <folder> [--out <file>]) or set ${SOURCE_SETTING}.`,
  );
  process.exit(1);
}

const count = (items: readonly string[]): string =>
  [...Map.groupBy(items, (item) => item)]
    .map(([item, group]) => `${group.length} ${item}`)
    .join(', ');

/** Counts only, never names: the mapped project may be private. */
function summaryOf({ nodes, edges, areas, runtimes, cycles }: ArchitectureMap): string {
  return [
    `Mapped ${nodes.length} nodes (${count(nodes.map(({ kind }) => kind))})`,
    `and ${edges.length} edges (${count(edges.map(({ kind }) => kind))})`,
    `in ${areas.length} areas across ${runtimes.length} runtimes, with ${cycles.length} import cycles.`,
  ].join(' ');
}

const started = performance.now();
const map = await scanProject(resolve(source), {
  ...(values['server-root'] === undefined ? {} : { serverRoot: values['server-root'] }),
  ...(values['browser-root'] === undefined ? {} : { browserRoot: values['browser-root'] }),
});
const destination = values.out === undefined ? ARCHITECTURE_FILE : resolve(values.out);
await writeArchitecture(map, destination);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(`${summaryOf(map)} Scanned in ${seconds} s. Written to ${destination}`);
