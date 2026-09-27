import { BadRequest } from '../http/api-handler.ts';
import { actionReply } from './action-reply.ts';
import { agentReply } from './agent/agent-reply.ts';
import type { Agent } from './agent/jev-agent.ts';
import { fallbackReply } from './fallback.ts';
import { type KeywordMatch, keywordMatch } from './keyword-match.ts';
import { OpenRouterError } from './open-router-error.ts';
import type { Proposer } from './proposal.ts';
import type {
  AssistantStatus,
  HistoryTurn,
  JevSwitch,
  Pick,
  Project,
  Reply,
  RouteReply,
  RouteRequest,
  Source,
  Via,
  Where,
} from './route-contract.ts';
import type { SkillSource } from './skills-table.ts';

/** What Home asks of the assistant. */
export interface AssistantRouter {
  status(): Promise<AssistantStatus>;
  route(request: RouteRequest): Promise<RouteReply>;
}

export interface AssistantOptions {
  readonly agent: Agent;
  /** The projects a request can name, each with its star map. */
  readonly projects: () => Promise<readonly Project[]>;
  readonly skills: SkillSource;
  readonly where: Where;
  /** What turns tier-3 work into a proposal, with a run where one can be had. */
  readonly proposals: Proposer;
  readonly warn?: (line: string) => void;
}

const JEV_OFF = 'Jev is off, so I can only match app actions.';

type Routed = Reply & {
  readonly via: Via;
  readonly skill?: string;
  readonly sources?: readonly Source[];
};

/** A typed request: its words, and the conversation they continue. */
interface Typed {
  readonly text: string;
  readonly history: readonly HistoryTurn[];
}

/**
 * What Home does with a request. One that names an app action in so many
 * words is matched with no model call, so it is instant, free, and works with
 * no key; the rest goes to Jev, an agent that answers in words and uses the
 * dashboard as its tools. Work in a project is only ever proposed.
 */
export function assistantRouter(options: AssistantOptions): AssistantRouter {
  const { agent, skills, where, proposals, warn = console.warn } = options;
  const jevSwitch = (): JevSwitch => (agent.isOn ? 'on' : 'off');
  const byName = (projects: readonly Project[], name: string): Project | null =>
    projects.find((each) => each.name === name) ?? null;

  /** A button the page offered, pressed: do exactly that. */
  async function picked(text: string, pick: Pick, projects: readonly Project[]): Promise<Reply> {
    const project = pick.project == null ? null : byName(projects, pick.project);
    if (pick.project != null && !project) throw new BadRequest('bad pick: no such project');
    if (pick.action) return actionReply(pick.action, project, projects);
    return proposals.propose({ prompt: text, project, projects });
  }

  /** Jev failed: match keywords instead, offering what still works. */
  function agentFailed(error: unknown, match: KeywordMatch): Routed {
    if (!(error instanceof OpenRouterError)) throw error;
    warn(error.message);
    const note = `Jev didn't answer (${error.words}), so I matched keywords instead.`;
    return { via: 'keyword', ...fallbackReply(match, note, { proposals: true }) };
  }

  async function fromAgent(
    typed: Typed,
    match: KeywordMatch,
    projects: readonly Project[],
  ): Promise<Routed> {
    try {
      const run = await agent.answer({ text: typed.text, history: typed.history, projects });
      const sourced = run.sources.length ? { sources: run.sources } : {};
      return { via: 'agent', ...agentReply(run, agent.by), ...sourced };
    } catch (error) {
      return agentFailed(error, match);
    }
  }

  async function fromText(typed: Typed, pick: Pick | null): Promise<Routed> {
    const projects = await options.projects();
    if (pick) return { via: 'pick', ...(await picked(typed.text, pick, projects)) };
    const match = keywordMatch(typed.text, projects);
    if (match.action) {
      return { via: 'keyword', ...actionReply(match.action, match.project, projects) };
    }
    if (!agent.isOn) {
      return { via: 'keyword', ...fallbackReply(match, JEV_OFF, { proposals: where === 'local' }) };
    }
    return fromAgent(typed, match, projects);
  }

  /** A skill pressed: its fixed prompt, in its own project, the one picked for
   *  it, or whichever the owner picks next. A pin to a project with no star
   *  map is the owner's file out of date, so it gets a reply saying so. */
  async function fromSkill(id: string, pick: Pick | null): Promise<Routed> {
    const table = await skills();
    if (!Object.hasOwn(table, id)) throw new BadRequest('bad request: no such skill');
    const skill = table[id];
    const projects = await options.projects();
    const wanted = skill.project ?? pick?.project ?? null;
    const project = wanted === null ? null : byName(projects, wanted);
    if (skill.project !== undefined && !project) {
      return {
        via: 'skill',
        skill: id,
        note: `“${skill.label}” is for ${skill.project}, which has no star map here.`,
      };
    }
    if (wanted !== null && !project) throw new BadRequest('bad pick: no such project');
    const reply = await proposals.proposeSkill({ prompt: skill.prompt, project, projects });
    return { via: 'skill', skill: id, ...reply };
  }

  return {
    status: async () => ({
      jev: jevSwitch(),
      where,
      skills: Object.entries(await skills()).map(([id, skill]) => ({
        id,
        label: skill.label,
        description: skill.description,
        project: skill.project ?? null,
      })),
    }),
    route: async (request) => {
      const routed =
        request.skill === null
          ? await fromText(request, request.pick)
          : await fromSkill(request.skill, request.pick);
      return { ...routed, jev: jevSwitch() };
    },
  };
}
