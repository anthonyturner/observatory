import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SERVER = dirname(dirname(fileURLToPath(import.meta.url)));
const HOSTED_ENTRY = join(SERVER, '..', 'api', 'index.mjs');
/** Only this machine's server may hold these: they sign in to the owner's own accounts. */
const LOCAL_ONLY = [join(SERVER, 'mail') + sep];
/** A static `import … from './x.ts'` or `export … from` at the start of a line: the server has no dynamic imports. */
const RELATIVE_IMPORT = /^(?:import|export)\b[^'"]*?['"](\.{1,2}\/[^'"]+)['"]/gm;

/** Every file `entry` reaches through relative imports, itself included. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length) {
    const file = pending.pop() ?? '';
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, path] of readFileSync(file, 'utf8').matchAll(RELATIVE_IMPORT)) {
      pending.push(resolve(dirname(file), path));
    }
  }
  return seen;
}

describe('the hosted site', () => {
  it('never imports the code that signs in to the owner’s mail', () => {
    const reached = [...reachableFrom(HOSTED_ENTRY)];

    assert.ok(reached.some((file) => file.endsWith(join('hosted', 'hosted-api.ts'))));
    assert.deepEqual(
      reached
        .filter((file) => LOCAL_ONLY.some((folder) => file.startsWith(folder)))
        .map((file) => relative(SERVER, file)),
      [],
    );
  });

  it('is checked by a walk that does find the mail code from this machine’s server', () => {
    const reached = [...reachableFrom(join(SERVER, 'main.ts'))];

    assert.ok(reached.some((file) => file.endsWith(join('mail', 'imapflow-client.ts'))));
  });
});
