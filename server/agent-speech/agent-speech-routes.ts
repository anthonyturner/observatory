import { BadRequest, type RouteTable } from '../http/api-handler.ts';
import type { AgentSpeechReader } from './agent-speech-state.ts';
import type { JevHold } from './jev-hold.ts';

export const AGENT_SPEECH_PATH = '/api/agent-speech';
export const JEV_HOLD_PATH = '/api/agent-speech/hold';

export interface AgentSpeechRoutesOptions {
  readonly speech: AgentSpeechReader;
  readonly hold: JevHold;
}

/** The marker is one ASCII line, so a token is kept to letters, digits and dashes. */
const TOKEN = /^[A-Za-z0-9-]{1,64}$/;

function tokenOf(value: unknown): string {
  if (typeof value !== 'string' || !TOKEN.test(value)) {
    throw new BadRequest('bad request: token must be 1 to 64 letters, digits or dashes');
  }
  return value;
}

const tokenInBody = (body: unknown): string =>
  tokenOf(typeof body === 'object' && body !== null ? Reflect.get(body, 'token') : undefined);

/**
 * `table` with the routes that let Jev and Agent Speak take turns:
 *
 *   GET    /api/agent-speech              { busy, speaking, paused, queued }
 *   POST   /api/agent-speech/hold         { token } → Jev is speaking: hold Agent Speak a few seconds more
 *   DELETE /api/agent-speech/hold?token=  he has finished
 *
 * All three need the write header, and the loopback guard in main.ts: they
 * read and write files in the owner's home folder. The hosted site never adds
 * them (ADR-0006).
 */
export function withAgentSpeechRoutes(
  table: RouteTable,
  { speech, hold }: AgentSpeechRoutesOptions,
): RouteTable {
  return {
    ...table,
    guardedGet: { ...table.guardedGet, [AGENT_SPEECH_PATH]: () => speech.read() },
    post: {
      ...table.post,
      [JEV_HOLD_PATH]: async (body) => {
        hold.renew(tokenInBody(body));
        return null;
      },
    },
    delete: {
      ...table.delete,
      [JEV_HOLD_PATH]: async (query) => {
        hold.release(tokenOf(query.get('token')));
        return null;
      },
    },
  };
}
