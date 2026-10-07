import { agentNameOf } from '../agents/agent-usage-report.ts';
import { rememberProjects, resolveProject } from '../usage/checkout-projects.ts';
import type { ProjectOf, ProjectRef } from '../usage/project-usage.ts';
import { SESSION_LOGS_DIR } from '../usage/usage-paths.ts';
import { LISTED_MS, classify } from './agent-state.ts';
import { AnswerIndex } from './answer-index.ts';
import type { AgentKey, LiveAgent, LiveAgentAnswer, LiveAgentsReport } from './live-agent-types.ts';
import type { LiveAgentsSource } from './live-agents-routes.ts';
import { type Answers, mergedAnswers } from './transcript-answers.ts';
import {
  type TranscriptFile,
  metaOf,
  sessionTranscriptsSince,
  transcriptOf,
  transcriptsSince,
} from './transcript-files.ts';
import { text } from './transcript-lines.ts';
import { type TranscriptSummary, summaryOf } from './transcript-summary.ts';
import { tailLines } from './transcript-window.ts';

/** Where the live list reads from; a test gives its own folder. */
export interface TranscriptSources {
  readonly logsDir: string;
  readonly projectOf: ProjectOf;
}

const DEFAULT_SOURCES: TranscriptSources = {
  logsDir: SESSION_LOGS_DIR,
  projectOf: resolveProject,
};

const UNKNOWN_PROJECT: ProjectRef = { name: 'unknown', repo: null };

/** What a subagent's metadata says about the task it was given. */
interface Meta {
  readonly agentType: string | null;
  readonly description: string;
  /** The spawner's call that started it, whose answer means it has finished. */
  readonly toolUseId: string | null;
}

interface ReadTranscript {
  readonly file: TranscriptFile;
  readonly summary: TranscriptSummary;
  readonly meta: Meta | null;
}

function metaFrom(json: string | null): Meta {
  let fields: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json ?? '{}');
    if (typeof parsed === 'object' && parsed !== null) fields = parsed as Record<string, unknown>;
  } catch {
    fields = {};
  }
  return {
    agentType: text(fields['agentType']),
    description: text(fields['description']) ?? '',
    toolUseId: text(fields['toolUseId']),
  };
}

async function read(file: TranscriptFile): Promise<ReadTranscript> {
  const isSubagent = file.key.agentId !== null;
  const [lines, meta] = await Promise.all([
    tailLines(file.file),
    isSubagent ? metaOf(file.file) : Promise.resolve(null),
  ]);
  return { file, summary: summaryOf(lines), meta: isSubagent ? metaFrom(meta) : null };
}

/** A subagent still to be told apart from a finished one by its spawner's answer. */
const isOpenSubagent = ({ meta, summary }: ReadTranscript): boolean =>
  meta !== null && !summary.isTurnEnded;

/** Answers from every transcript of one session: a nested subagent's spawner is
 *  another subagent, not the session. Read only where a subagent needs them. */
async function answersOf(index: AnswerIndex, session: readonly ReadTranscript[]): Promise<Answers> {
  if (!session.some(isOpenSubagent)) return mergedAnswers([]);
  return mergedAnswers(await Promise.all(session.map(({ file }) => index.answersIn(file.file))));
}

/** A subagent whose spawner has its answer, given after its own last write, has
 *  finished. One answered and then resumed has written since, so it has not. */
function isFinished(transcript: ReadTranscript, answers: Answers): boolean {
  const { file, summary, meta } = transcript;
  if (!meta || !file.key.agentId) return false;
  if (summary.isTurnEnded) return true;
  const lastWrite = summary.lastLineAt ?? file.modifiedAt;
  const call = meta.toolUseId ? answers.calls.get(meta.toolUseId) : undefined;
  const answeredAt = Math.max(call ?? -Infinity, answers.tasks.get(file.key.agentId) ?? -Infinity);
  return answeredAt >= lastWrite;
}

function liveAgentOf(
  transcript: ReadTranscript,
  answers: Answers,
  projectOf: ProjectOf,
  now: number,
): LiveAgent {
  const { file, summary, meta } = transcript;
  const project = summary.cwd ? projectOf(summary.cwd) : UNKNOWN_PROJECT;
  const { state, quietMinutes } = classify(
    {
      lastWriteAt: file.modifiedAt,
      // A subagent answers its spawner, not a person: its ended turn is its end.
      isTurnEnded: !meta && summary.isTurnEnded,
      isFinished: isFinished(transcript, answers),
    },
    now,
  );
  return {
    session: file.key.session,
    agentId: file.key.agentId,
    agent: meta ? agentNameOf(meta.agentType) : null,
    title: meta?.description || summary.title || '',
    project: project.name,
    repo: project.repo,
    branch: summary.branch,
    folder: summary.cwd ?? '',
    state,
    quietMinutes,
    lastActiveAt: new Date(file.modifiedAt).toISOString(),
    lastTool: summary.lastTool,
    isHeadless: summary.isHeadless,
  };
}

function bySession(reads: readonly ReadTranscript[]): ReadTranscript[][] {
  const groups = new Map<string, ReadTranscript[]>();
  for (const one of reads) {
    groups.set(one.file.key.session, [...(groups.get(one.file.key.session) ?? []), one]);
  }
  return [...groups.values()];
}

async function listAt(
  sources: TranscriptSources,
  index: AnswerIndex,
  now: number,
): Promise<LiveAgentsReport> {
  const projectOf = rememberProjects(sources.projectOf);
  const files = await transcriptsSince(sources.logsDir, now - LISTED_MS);
  index.keepOnly(new Set(files.map(({ file }) => file)));
  const sessions = bySession(await Promise.all(files.map(read)));
  const agents = await Promise.all(
    sessions.map(async (session) => {
      const answers = await answersOf(index, session);
      return session
        .filter(({ summary }) => summary.isConversation)
        .map((one) => liveAgentOf(one, answers, projectOf, now))
        .filter((agent) => agent.state !== 'not-running');
    }),
  );
  return { generatedAt: new Date(now).toISOString(), agents: agents.flat() };
}

async function oneAt(
  sources: TranscriptSources,
  index: AnswerIndex,
  key: AgentKey,
  now: number,
): Promise<LiveAgentAnswer> {
  const generatedAt = new Date(now).toISOString();
  const target = await transcriptOf(sources.logsDir, key);
  if (!target) return { generatedAt, agent: null };
  const others = key.agentId
    ? await sessionTranscriptsSince(sources.logsDir, key.session, now - LISTED_MS)
    : [];
  const session = await Promise.all(
    [target, ...others.filter((other) => other.file !== target.file)].map(read),
  );
  const answers = await answersOf(index, session);
  return { generatedAt, agent: liveAgentOf(session[0], answers, sources.projectOf, now) };
}

/** The agents running on this machine, and any one of them, read from its
 *  transcripts as of each request. */
export function liveAgentReader(
  sources = DEFAULT_SOURCES,
  clock: () => number = Date.now,
): LiveAgentsSource {
  const index = new AnswerIndex();
  return {
    list: () => listAt(sources, index, clock()),
    one: (key) => oneAt(sources, index, key, clock()),
  };
}
