import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { SAMPLES_FILE } from './usage-paths.ts';

// A one-time step while pr-starmap is retired: its status-line readings use
// the same line format, so they carry over as Observatory's history.

const PR_STARMAP_SAMPLES = join(homedir(), '.claude', 'pr-starmap', 'usage', 'samples.jsonl');

if (existsSync(SAMPLES_FILE)) {
  console.log(`Nothing to do: ${SAMPLES_FILE} already exists.`);
} else if (!existsSync(PR_STARMAP_SAMPLES)) {
  console.log(`Nothing to import: ${PR_STARMAP_SAMPLES} does not exist.`);
} else {
  mkdirSync(dirname(SAMPLES_FILE), { recursive: true });
  copyFileSync(PR_STARMAP_SAMPLES, SAMPLES_FILE);
  console.log(`Imported limit readings into ${SAMPLES_FILE}.`);
}
