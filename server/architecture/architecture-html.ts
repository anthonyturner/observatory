import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { MAP_ELEMENT_ID } from '../../viewer/architecture-map/map-source.ts';
import { MAP_SCHEMA, type ArchitectureMap } from './architecture-types.ts';
import { mapProblems } from './map-problems.ts';

const VIEWER_ENTRY = fileURLToPath(
  new URL('../../viewer/architecture-map/main.ts', import.meta.url),
);

/** How many broken rules a refusal names; the rest are counted. */
const PROBLEMS_SHOWN = 5;

const LINE_SEPARATOR = 0x2028;
const PARAGRAPH_SEPARATOR = 0x2029;

/** `<` would close the script element or open a comment; the separators end a line in older scripts. */
const SCRIPT_UNSAFE = new RegExp(
  `[<${String.fromCharCode(LINE_SEPARATOR, PARAGRAPH_SEPARATOR)}]`,
  'g',
);

const unicodeEscape = (character: string): string =>
  `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;

/** JSON that can sit inside a script element. Only a string can hold these characters, and an escape reads back the same. */
const jsonForScript = (value: unknown): string =>
  JSON.stringify(value).replace(SCRIPT_UNSAFE, unicodeEscape);

/** Script text that can sit inside a script element; only a string can hold these sequences. */
const scriptForPage = (script: string): string =>
  script.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--');

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

interface ViewerBundle {
  readonly script: string;
  readonly styles: string;
}

/** The viewer's code, layout worker and stylesheets, each as one text. */
async function bundleViewer(): Promise<ViewerBundle> {
  const { outputFiles } = await build({
    entryPoints: [VIEWER_ENTRY],
    outdir: 'viewer',
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    loader: { '.min.js': 'text' },
    logLevel: 'silent',
  });
  const textOf = (extension: string): string =>
    outputFiles.find(({ path }) => path.endsWith(extension))?.text ?? '';
  return { script: textOf('.js'), styles: textOf('.css') };
}

/**
 * The map as one HTML file that opens from disk with no network: the viewer's script and
 * styles and the map's JSON are all inside it. Refuses a map the views could not draw soundly.
 */
export async function architectureHtml(map: ArchitectureMap): Promise<string> {
  if (map.schema !== MAP_SCHEMA) {
    throw new Error(
      `The map is schema ${map.schema}; the viewer reads schema ${MAP_SCHEMA}. Scan again.`,
    );
  }
  const problems = mapProblems(map);
  if (problems.length > 0) {
    const shown = problems.slice(0, PROBLEMS_SHOWN).join('; ');
    const more =
      problems.length > PROBLEMS_SHOWN ? ` (and ${problems.length - PROBLEMS_SHOWN} more)` : '';
    throw new Error(`The map breaks its own rules: ${shown}${more}.`);
  }
  const { script, styles } = await bundleViewer();
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Architecture map: ${escapeHtml(map.project)}</title>`,
    `<style>${styles}</style>`,
    '</head>',
    '<body>',
    `<script type="application/json" id="${MAP_ELEMENT_ID}">${jsonForScript(map)}</script>`,
    `<script>${scriptForPage(script)}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
