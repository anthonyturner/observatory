import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ARCHITECTURE_FILE } from './architecture-file.ts';
import { architectureHtml } from './architecture-html.ts';
import { scanFromCommandLine } from './scan-command.ts';

/** Beside the saved map, outside any checkout: the page names every class and file of the project. */
const DEFAULT_PAGE = join(dirname(ARCHITECTURE_FILE), 'map.html');

try {
  const { map, out = DEFAULT_PAGE, summary, seconds } = await scanFromCommandLine('arch:map');
  const html = await architectureHtml(map);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  const size = `${Math.round(html.length / 1024)} kB`;
  console.log(
    `${summary} Scanned in ${seconds} s. Wrote ${out} (${size}); open it in a browser, it needs no server.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
