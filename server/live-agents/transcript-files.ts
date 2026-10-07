/* Where Claude Code keeps each transcript, under the session logs folder:

     <project>/<session>.jsonl                             a session
     <project>/<session>/subagents/agent-<id>.jsonl        one of its subagents
     <project>/<session>/subagents/agent-<id>.meta.json    that subagent's task

   Only these shapes are opened; `memory/` and `tool-results/` never are. */

import type { Dirent } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import type { AgentKey } from './live-agent-types.ts';

/** One transcript on disk, named by its ids. */
export interface TranscriptFile {
  readonly key: AgentKey;
  readonly file: string;
  readonly modifiedAt: number;
}

const SESSION_FILE = /^([0-9a-f-]{36})\.jsonl$/i;
const AGENT_FILE = /^agent-([0-9a-f]+)\.jsonl$/i;
const SUBAGENTS = 'subagents';

async function entriesOf(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function modifiedAt(file: string): Promise<number | null> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return null;
  }
}

async function fileOf(key: AgentKey, file: string): Promise<TranscriptFile | null> {
  const at = await modifiedAt(file);
  return at === null ? null : { key, file, modifiedAt: at };
}

const sessionFileOf = (project: string, session: string): string =>
  join(project, `${session}.jsonl`);

const agentFileOf = (project: string, session: string, agentId: string): string =>
  join(project, session, SUBAGENTS, `agent-${agentId}.jsonl`);

/** The subagent's task, beside its transcript. */
const metaFileOf = (transcript: string): string => transcript.replace(/\.jsonl$/, '.meta.json');

async function subagentsOf(project: string, session: string): Promise<(TranscriptFile | null)[]> {
  const entries = await entriesOf(join(project, session, SUBAGENTS));
  return Promise.all(
    entries.flatMap((entry) => {
      const agentId = AGENT_FILE.exec(entry.name)?.[1];
      if (!entry.isFile() || !agentId) return [];
      return [fileOf({ session, agentId }, agentFileOf(project, session, agentId))];
    }),
  );
}

async function transcriptsIn(project: string): Promise<(TranscriptFile | null)[]> {
  const found = await Promise.all(
    (await entriesOf(project)).map(async (entry) => {
      const session = SESSION_FILE.exec(entry.name)?.[1];
      if (entry.isFile() && session) {
        return [await fileOf({ session, agentId: null }, sessionFileOf(project, session))];
      }
      return entry.isDirectory() && SESSION_FILE.test(`${entry.name}.jsonl`)
        ? subagentsOf(project, entry.name)
        : [];
    }),
  );
  return found.flat();
}

const projectsIn = async (logsDir: string): Promise<string[]> =>
  (await entriesOf(logsDir))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(logsDir, entry.name));

/** Every session and subagent transcript under `logsDir` written at or after `from`. */
export async function transcriptsSince(logsDir: string, from: number): Promise<TranscriptFile[]> {
  const found = await Promise.all((await projectsIn(logsDir)).map(transcriptsIn));
  return found
    .flat()
    .filter((file): file is TranscriptFile => file !== null && file.modifiedAt >= from);
}

/** `file` is inside `dir`, so no id, however it was spelled, reads outside it. */
export function isInside(dir: string, file: string): boolean {
  const path = relative(dir, file);
  return path !== '' && !path.startsWith('..') && !isAbsolute(path);
}

/** The transcript `key` names, in whichever project folder holds it, or null. */
export async function transcriptOf(logsDir: string, key: AgentKey): Promise<TranscriptFile | null> {
  for (const project of await projectsIn(logsDir)) {
    const file = key.agentId
      ? agentFileOf(project, key.session, key.agentId)
      : sessionFileOf(project, key.session);
    if (!isInside(logsDir, file)) return null;
    const found = await fileOf(key, file);
    if (found) return found;
  }
  return null;
}

/** The session's other transcripts written at or after `from`: where its subagents' answers are. */
export async function sessionTranscriptsSince(
  logsDir: string,
  session: string,
  from: number,
): Promise<TranscriptFile[]> {
  const found = await Promise.all(
    (await projectsIn(logsDir)).map(async (project) => [
      await fileOf({ session, agentId: null }, sessionFileOf(project, session)),
      ...(await subagentsOf(project, session)),
    ]),
  );
  return found
    .flat()
    .filter((file): file is TranscriptFile => file !== null && file.modifiedAt >= from);
}

/** A subagent's metadata file, or null when it cannot be read. */
export async function metaOf(transcript: string): Promise<string | null> {
  try {
    return await readFile(metaFileOf(transcript), 'utf8');
  } catch {
    return null;
  }
}
