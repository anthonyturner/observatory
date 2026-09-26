import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OBSERVATORY_DIR } from '../store/file-store.ts';
import { type SkillSource, skillTable } from './skills-table.ts';

/** The owner's own skills for Home. */
const SKILLS_FILE = join(OBSERVATORY_DIR, 'skills.json');

/** Far more than a list of skills needs. The file is read on every
 *  /api/route request, so a runaway one is refused before it is read. */
export const MAX_SKILLS_BYTES = 64 * 1024;
const BYTES_PER_KIB = 1024;

type Warn = (line: string) => void;

/** Each distinct warning once per run: the file is read on every request,
 *  and one line per request would bury the rest of the log. */
export function warnOnce(warn: Warn = console.warn): Warn {
  const warned = new Set<string>();
  return (line) => {
    if (warned.has(line)) return;
    warned.add(line);
    warn(line);
  };
}

/** skills.json as written, or {} when there is none. A file too big or not
 *  JSON is reported, since its skills would otherwise be missing with no word why. */
export function readSkillsFile(file: string, warn: Warn): unknown {
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return {};
  }
  if (size > MAX_SKILLS_BYTES) {
    const kib = Math.ceil(size / BYTES_PER_KIB);
    warn(
      `${file}: ${kib} KiB is over the ${MAX_SKILLS_BYTES / BYTES_PER_KIB} KiB limit, so only the starter skills show`,
    );
    return {};
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    warn(`${file}: not JSON, so only the starter skills show (${(error as Error).message})`);
    return {};
  }
}

/** The starters with the owner's skills.json over them, read on each call. */
export function fileSkills(file = SKILLS_FILE, warn: Warn = warnOnce()): SkillSource {
  return async () => skillTable(readSkillsFile(file, warn), warn);
}
