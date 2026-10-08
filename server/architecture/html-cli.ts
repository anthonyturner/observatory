import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readMap } from '../../viewer/architecture-map/map-source.ts';
import { ARCHITECTURE_FILE } from './architecture-file.ts';
import { architectureHtml } from './architecture-html.ts';
import { isMissingFile } from './project-source.ts';

const USAGE = 'Usage: npm run arch:html -- [map.json] [--out map.html]';

const { values, positionals } = parseArgs({
  options: { out: { type: 'string' } },
  allowPositionals: true,
});

const mapFile = resolve(positionals[0] ?? ARCHITECTURE_FILE);
const { dir, name } = parse(mapFile);
const outFile = resolve(values.out ?? join(dir, `${name}.html`));

async function mapText(): Promise<string> {
  try {
    return await readFile(mapFile, 'utf8');
  } catch (error) {
    if (!isMissingFile(error)) throw error;
    console.error(
      `No map at ${mapFile}. Scan a project first (npm run arch:scan -- <folder>).\n${USAGE}`,
    );
    process.exit(1);
  }
}

try {
  const map = readMap(await mapText());
  const html = await architectureHtml(map);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, html);
  const size = `${Math.round(html.length / 1024)} kB`;
  console.log(
    `Wrote ${outFile} (${size}): ${map.nodes.length} nodes, ${map.edges.length} edges. Open it in a browser; it needs no server.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
