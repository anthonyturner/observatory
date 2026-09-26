import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_TRIAGE, type TriageState } from './triage.ts';

/** Where each repository's triage is kept. */
export interface TriageStore {
  read(repo: string): TriageState;
  write(repo: string, state: TriageState): void;
}

export const TRIAGE_DIR = join(homedir(), '.claude', 'observatory', 'triage');

/** `owner/name` as a file name: the name check already rules out anything else. */
const fileOf = (dir: string, repo: string): string => join(dir, `${repo.replace('/', '__')}.json`);

/** Triage in one JSON file per repository. A file that is missing or does not
 *  parse reads as no triage; a write lands whole or not at all. */
export function fileTriageStore(dir = TRIAGE_DIR): TriageStore {
  return {
    read(repo) {
      try {
        const stored = JSON.parse(readFileSync(fileOf(dir, repo), 'utf8')) as Partial<TriageState>;
        return {
          seen: stored.seen ?? {},
          dismissed: stored.dismissed ?? {},
          snoozed: stored.snoozed ?? {},
        };
      } catch {
        return EMPTY_TRIAGE;
      }
    },
    write(repo, state) {
      mkdirSync(dir, { recursive: true });
      const file = fileOf(dir, repo);
      const staged = `${file}.tmp`;
      writeFileSync(staged, JSON.stringify(state, null, 2), 'utf8');
      renameSync(staged, file);
    },
  };
}
