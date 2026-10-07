import { Observable, of } from 'rxjs';
import { LiveAgentsApi } from '../live-agents-api';
import { LiveAgent, LiveAgentsState, OneAgentState } from '../live-agents.types';

export const SESSION = '11111111-1111-4111-8111-111111111111';

/** A session working in observatory a minute ago, with any field replaced. */
export const liveAgent = (overrides: Partial<LiveAgent> = {}): LiveAgent => ({
  session: SESSION,
  agentId: null,
  agent: null,
  title: 'Build the agents list',
  project: 'observatory',
  repo: 'me/observatory',
  branch: 'feat/490-agents',
  folder: 'E:\\repos\\observatory-wt-490',
  state: 'working',
  quietMinutes: null,
  lastActiveAt: '2026-10-07T09:00:00.000Z',
  lastTool: 'Read src/app.ts',
  isHeadless: false,
  ...overrides,
});

/** An API that answers every read with `list` and `one`, as a test sets them. */
export function fakeLiveAgentsApi(
  list: () => Observable<LiveAgentsState> = () => of({ status: 'ready', agents: [] }),
  one: () => Observable<OneAgentState> = () => of({ status: 'ready', agent: null }),
): LiveAgentsApi {
  return { list, one };
}
