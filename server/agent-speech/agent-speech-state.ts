import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_SPEAK_DIR, AGENT_SPEAK_FILES } from './agent-speak-files.ts';
import { type SpeakProcessCheck, speakProcessCheck } from './speak-process.ts';

/** What `GET /api/agent-speech` answers: whether Agent Speak is talking now. */
export interface AgentSpeech {
  /** Jev should wait: a line is playing unpaused, or more are on their way. */
  readonly busy: boolean;
  readonly speaking: boolean;
  /** Anthony paused it himself, which Jev does not wait for. */
  readonly paused: boolean;
  readonly queued: boolean;
}

export interface AgentSpeechReader {
  read(): Promise<AgentSpeech>;
}

export interface AgentSpeechOptions {
  readonly root?: string;
  readonly isSpeakProcess?: SpeakProcessCheck;
}

const PAUSED = 'pause';
const QUEUED_LINE = /\.txt$/i;

/** A file's text, or '' when it is missing or cannot be read. */
function textOf(file: string): string {
  try {
    return readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}

function hasQueuedLine(folder: string): boolean {
  try {
    return readdirSync(folder).some((name) => QUEUED_LINE.test(name));
  } catch {
    return false;
  }
}

/** Agent Speak's state from its own files under `root`. A missing, stale or
 *  unreadable file reads as false. */
export function agentSpeechReader(options: AgentSpeechOptions = {}): AgentSpeechReader {
  const root = options.root ?? AGENT_SPEAK_DIR;
  const isSpeakProcess = options.isSpeakProcess ?? speakProcessCheck();
  const isLive = async (name: string): Promise<boolean> => {
    const stamp = textOf(join(root, name));
    return stamp !== '' && isSpeakProcess(stamp);
  };
  return {
    async read() {
      const speaking = await isLive(AGENT_SPEAK_FILES.player);
      const paused = textOf(join(root, AGENT_SPEAK_FILES.control)) === PAUSED;
      const queued =
        hasQueuedLine(join(root, AGENT_SPEAK_FILES.queue)) ||
        (await isLive(AGENT_SPEAK_FILES.drainer));
      const busy = (speaking && !paused) || (!speaking && queued);
      return { busy, speaking, paused, queued };
    },
  };
}
