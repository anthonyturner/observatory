import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Handoff } from './agents-report.ts';

/** Every handoff the capture hook recorded, on this machine. */
export const HANDOFFS_FILE = join(homedir(), '.claude', 'observatory', 'handoffs.jsonl');

export interface HandoffStore {
  read(): Handoff[];
  append(handoff: Handoff): void;
}

/** Handoffs as JSON lines; a torn line is skipped, the rest still stands. */
export function fileHandoffStore(file = HANDOFFS_FILE): HandoffStore {
  return {
    read() {
      let text: string;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        return [];
      }
      return text
        .split('\n')
        .filter((line) => line.trim())
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as Handoff];
          } catch {
            return [];
          }
        });
    },
    append(handoff) {
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, `${JSON.stringify(handoff)}\n`, 'utf8');
    },
  };
}
