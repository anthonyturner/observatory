import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Handoff } from './agents-report.ts';
import { HANDOFFS_FILE, fileHandoffStore } from './handoff-store.ts';

// A one-time step while pr-starmap is retired: its capture hook wrote the same
// handoff lines, one file per repository, under `.claude/queue/`.

/** Where pr-starmap kept a repository's handoffs. */
const PR_STARMAP_HANDOFFS = join('.claude', 'queue', 'handoffs.jsonl');

const keyOf = (handoff: Handoff): string =>
  [handoff.at, handoff.kind, handoff.session, handoff.pr ?? ''].join('|');

/** The handoffs in `incoming` not already in `existing`, oldest first, each once. */
export function unrecorded(existing: readonly Handoff[], incoming: readonly Handoff[]): Handoff[] {
  const seen = new Set(existing.map(keyOf));
  const fresh: Handoff[] = [];
  for (const handoff of incoming) {
    const key = keyOf(handoff);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(handoff);
  }
  return fresh.sort((a, b) => a.at.localeCompare(b.at));
}

/** pr-starmap's handoff files in the repositories beside `root`. */
export function pastHandoffFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, PR_STARMAP_HANDOFFS))
    .filter((file) => existsSync(file));
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('agents/import-history.ts')) {
  // The files named on the command line, or else every repository beside this one.
  const named = process.argv.slice(2);
  const repos = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const files = named.length ? named : pastHandoffFiles(repos);
  const store = fileHandoffStore();
  const fresh = unrecorded(
    store.read(),
    files.flatMap((file) => fileHandoffStore(file).read()),
  );
  fresh.forEach((handoff) => store.append(handoff));
  console.log(
    files.length
      ? `Imported ${fresh.length} handoffs from ${files.length} files into ${HANDOFFS_FILE}.`
      : 'Nothing to import: no pr-starmap handoff files were found.',
  );
}
