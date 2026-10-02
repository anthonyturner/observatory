import { basename, resolve } from 'node:path';
import { localSetting } from '../util/local-setting.ts';
import { AREA_RULES } from './area-rules.ts';
import { ARCHITECTURE_FILE, writeArchitecture } from './architecture-file.ts';
import { architectureMap } from './architecture-map.ts';
import { manifestWindows, scannedFiles } from './project-source.ts';

/** The setting that names the project to map when no folder is given on the command line. */
const SOURCE_SETTING = 'OBSERVATORY_ARCH_SOURCE';

const source = process.argv[2] ?? localSetting(SOURCE_SETTING);
if (!source) {
  console.error(
    `Which project? Pass its folder (npm run arch:scan -- <folder>) or set ${SOURCE_SETTING}.`,
  );
  process.exit(1);
}

const projectRoot = resolve(source);
const map = architectureMap({
  project: basename(projectRoot),
  scannedAt: new Date().toISOString(),
  windows: await manifestWindows(projectRoot),
  rules: AREA_RULES,
  files: await scannedFiles(projectRoot),
});
await writeArchitecture(map);
console.log(
  `Mapped ${map.nodes.length} classes and ${map.edges.length} injections to ${ARCHITECTURE_FILE}`,
);
