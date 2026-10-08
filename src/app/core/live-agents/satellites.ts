import { headsOf } from '../queue/stacks';
import { QueueItem } from '../queue/queue-report';
import { LiveAgent, LiveAgentState } from './live-agents.types';
import { stateText, titleText } from './live-agents-view';

/** The states a satellite is shown in: an agent that is not running has none. */
export type SatelliteState = Exclude<LiveAgentState, 'not-running'>;

/** A live agent as the Review Queue's sky draws it: a satellite. */
export interface Satellite {
  /** The session, and the subagent in it: one satellite each. */
  readonly key: string;
  readonly name: string;
  readonly state: SatelliteState;
  /** The pull request whose star it orbits, or null for the parking orbit. */
  readonly pr: number | null;
  /** "Working", "Quiet 14 min": what hover says after the name. */
  readonly stateText: string;
}

/** How often a satellite's light and beep fire in each state it is shown in. */
export const SATELLITE_RHYTHM: Readonly<
  Record<SatelliteState, { blinkMs: number; beepMs: number }>
> = {
  working: { blinkMs: 600, beepMs: 1_500 },
  waiting: { blinkMs: 1_400, beepMs: 4_000 },
  quiet: { blinkMs: 3_000, beepMs: 9_000 },
};

export interface SatelliteSources {
  readonly agents: readonly LiveAgent[];
  /** The queue's repository, `owner/name`, any case. */
  readonly repo: string;
  /** The open pull requests the sky shows stars for. */
  readonly pulls: readonly Pick<QueueItem, 'number' | 'branch' | 'base'>[];
  /** Pull requests a crew ship already flies by. */
  readonly crewed: ReadonlySet<number>;
}

/**
 * The satellites for `sources`: one per live agent in the repository that is
 * running. It orbits the star of the pull request whose head branch is the
 * agent's, else the parking orbit. A headless run on a crewed pull request's
 * branch is that crew, already a ship, so it gets none.
 */
export function satellitesOf({ agents, repo, pulls, crewed }: SatelliteSources): Satellite[] {
  const wanted = repo.toLowerCase();
  const heads = headsOf(pulls);
  const satellites: Satellite[] = [];
  for (const agent of agents) {
    if (agent.state === 'not-running' || agent.repo?.toLowerCase() !== wanted) continue;
    const pr = agent.branch ? (heads.get(agent.branch) ?? null) : null;
    if (agent.isHeadless && pr !== null && crewed.has(pr)) continue;
    satellites.push({
      key: `${agent.session}/${agent.agentId ?? ''}`,
      name: titleText(agent),
      state: agent.state,
      pr,
      stateText: stateText(agent),
    });
  }
  return satellites;
}
