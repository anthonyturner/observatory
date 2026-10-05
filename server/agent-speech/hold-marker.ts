import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_SPEAK_DIR, AGENT_SPEAK_FILES } from './agent-speak-files.ts';

/** The one file Observatory writes for Agent Speak: `<expiryUnixMs>|<token>`,
 *  which it reads as "Jev is speaking, hold your lines until then". */
export interface HoldMarker {
  write(expiresAt: number, token: string): void;
  /** Removes the marker, or, when Windows will not let it go, leaves it already expired. */
  clear(now: number, token: string): void;
}

export interface HoldMarkerOptions {
  readonly root?: string;
  readonly warn?: (message: string) => void;
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The marker under `root`, Agent Speak's folder. Nothing is written where
 *  Agent Speak is not installed. A failed write is warned of and left to the
 *  next renewal: a marker that is not renewed lapses by itself. */
export function holdMarker(options: HoldMarkerOptions = {}): HoldMarker {
  const root = options.root ?? AGENT_SPEAK_DIR;
  const warn = options.warn ?? ((message) => console.warn(message));
  const file = join(root, AGENT_SPEAK_FILES.jevSpeaking);
  const staged = `${file}.tmp`;
  return {
    write(expiresAt, token) {
      if (!existsSync(root)) return;
      try {
        writeFileSync(staged, `${expiresAt}|${token}`, 'ascii');
        renameSync(staged, file);
      } catch (error) {
        warn(`Could not renew Jev's hold on Agent Speak: ${reasonOf(error)}`);
      }
    },
    clear(now, token) {
      if (!existsSync(file)) return;
      try {
        unlinkSync(file);
      } catch {
        try {
          writeFileSync(file, `${now}|${token}`, 'ascii');
        } catch (error) {
          warn(`Could not release Jev's hold on Agent Speak: ${reasonOf(error)}`);
        }
      }
    },
  };
}
