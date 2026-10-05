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
  /** Moves the staged file over the marker; tests give one that fails. */
  readonly rename?: (from: string, to: string) => void;
  /** Blocks for `ms`; tests give one that does not. */
  readonly pause?: (ms: number) => void;
}

/** Agent Speak opens the marker for under 1 ms to read it, and Windows
 *  refuses a rename over a file that is open, delete-sharing or not. A few
 *  short tries ride that out. They block rather than wait, so a late retry
 *  can never bring back a marker a release has just removed. */
const RENAME_TRIES = 3;
const RETRY_AFTER_MS = 5;
const BRIEFLY_LOCKED: ReadonlySet<string> = new Set(['EPERM', 'EBUSY']);

const isBrieflyLocked = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && BRIEFLY_LOCKED.has(String(error.code));

const blockFor = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

function renameWithRetry(
  rename: (from: string, to: string) => void,
  pause: (ms: number) => void,
  from: string,
  to: string,
): void {
  for (let tried = 1; ; tried++) {
    try {
      rename(from, to);
      return;
    } catch (error) {
      if (tried >= RENAME_TRIES || !isBrieflyLocked(error)) throw error;
      pause(RETRY_AFTER_MS);
    }
  }
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The marker under `root`, Agent Speak's folder. Nothing is written where
 *  Agent Speak is not installed. A failed write is warned of and left to the
 *  next renewal: a marker that is not renewed lapses by itself. */
export function holdMarker(options: HoldMarkerOptions = {}): HoldMarker {
  const root = options.root ?? AGENT_SPEAK_DIR;
  const warn = options.warn ?? ((message) => console.warn(message));
  const rename = options.rename ?? renameSync;
  const pause = options.pause ?? blockFor;
  const file = join(root, AGENT_SPEAK_FILES.jevSpeaking);
  const staged = `${file}.tmp`;
  return {
    write(expiresAt, token) {
      if (!existsSync(root)) return;
      try {
        writeFileSync(staged, `${expiresAt}|${token}`, 'ascii');
        renameWithRetry(rename, pause, staged, file);
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
