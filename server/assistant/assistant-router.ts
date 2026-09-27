import { BadRequest } from '../http/api-handler.ts';
import { questionsFor } from './actions.ts';
import { actionReply } from './action-reply.ts';
import { fallbackReply } from './fallback.ts';
import { type JevDecision, readJev } from './jev-reading.ts';
import { type KeywordMatch, keywordMatch } from './keyword-match.ts';
import { OpenRouterError } from './open-router-error.ts';
import type { JevAnswers, OpenRouter } from './open-router.ts';
import { proposer } from './proposal.ts';
import { quickReply } from './quick-reply.ts';
import { webReply } from './web-reply.ts';
import { wantsWeb } from './web-words.ts';
import type {
  AssistantStatus,
  JevSwitch,
  Pick,
  Project,
  ProposalRunner,
  Reply,
  RouteReply,
  RouteRequest,
  Via,
  Where,
} from './route-contract.ts';
import type { Shell } from './shell-commands.ts';
import type { SkillSource } from './skills-table.ts';

/** What Home asks of the assistant. */
export interface AssistantRouter {
  status(): Promise<AssistantStatus>;
  route(request: RouteRequest): Promise<RouteReply>;
}

export interface AssistantOptions {
  readonly models: OpenRouter;
  /** The projects a request can name, each with its star map. */
  readonly projects: () => Promise<readonly Project[]>;
  readonly skills: SkillSource;
  readonly where: Where;
  /** The shells a tier-3 command is written for. */
  readonly shells: readonly Shell[];
  /** What turns a proposal into a run; null where nothing can. */
  readonly runner: ProposalRunner | null;
  readonly warn?: (line: string) => void;
}

const JEV_OFF = 'Jev is off, so I can only match app actions.';
const UNSURE = 'Not sure what you meant. Did you mean:';
/** A refused key or an empty account fails the quick model the same way. */
const FAILS_QUICK_TOO = new Set(['key', 'credit']);
/** The page Jev is told the request came from. */
const HOME_PAGE = 'home';

type Routed = Reply & { readonly via: Via; readonly skill?: string; readonly confidence?: number };

/**
 * What Home does with a request: tier 1 is an app action the page carries
 * out, tier 2 a quick answer, tier 3 work in a project, only ever proposed. A
 * request that names an action in so many words is matched with no model
 * call, so it is instant, free, and works with no key; only the rest goes to Jev.
 */
export function assistantRouter(options: AssistantOptions): AssistantRouter {
  const { models, skills, where, warn = console.warn } = options;
  const proposals = proposer({ shells: options.shells, runner: options.runner });
  const jevSwitch = (): JevSwitch => (models.isOn ? 'on' : 'off');
  const byName = (projects: readonly Project[], name: string): Project | null =>
    projects.find((each) => each.name === name) ?? null;

  async function carryOut(
    decision: JevDecision,
    text: string,
    projects: readonly Project[],
  ): Promise<Reply> {
    switch (decision.kind) {
      case 'act':
        return actionReply(decision.action, decision.project, projects);
      case 'quick':
        return quickReply(models, text, warn);
      case 'look':
        return webReply(models, text, warn);
      case 'propose':
        return proposals.propose({ prompt: text, project: decision.project, projects });
      case 'unsure':
        return { question: UNSURE, ask: decision.ask };
    }
  }

  /** A button the page offered, pressed: do exactly that. */
  async function picked(text: string, pick: Pick, projects: readonly Project[]): Promise<Reply> {
    const project = pick.project == null ? null : byName(projects, pick.project);
    if (pick.project != null && !project) throw new BadRequest('bad pick: no such project');
    if (pick.action) return actionReply(pick.action, project, projects);
    if (pick.tier === 2) return quickReply(models, text, warn);
    if (pick.tier === 'web') return webReply(models, text, warn);
    return proposals.propose({ prompt: text, project, projects });
  }

  /** Jev failed: match keywords instead, offering what still works. */
  function jevFailed(error: unknown, match: KeywordMatch): Routed {
    if (!(error instanceof OpenRouterError)) throw error;
    warn(error.message);
    const note = `Jev didn't answer (${error.words}), so I matched keywords instead.`;
    const can = { quickAnswers: !FAILS_QUICK_TOO.has(error.reason), proposals: true };
    return { via: 'keyword', ...fallbackReply(match, note, can) };
  }

  async function fromJev(
    text: string,
    match: KeywordMatch,
    projects: readonly Project[],
  ): Promise<Routed> {
    const state = { request: text, page: HOME_PAGE, projects: projects.map((each) => each.name) };
    let answers: JevAnswers;
    try {
      answers = await models.decide(state, questionsFor(projects));
    } catch (error) {
      return jevFailed(error, match);
    }
    const { confidence, decision } = readJev(answers, match, projects);
    return { via: 'jev', confidence, ...(await carryOut(decision, text, projects)) };
  }

  async function fromText(text: string, pick: Pick | null): Promise<Routed> {
    const projects = await options.projects();
    if (pick) return { via: 'pick', ...(await picked(text, pick, projects)) };
    const match = keywordMatch(text, projects);
    if (match.action) {
      return { via: 'keyword', ...actionReply(match.action, match.project, projects) };
    }
    // News and searches need no Jev to recognise, and a web answer says itself
    // when there is no key to pay for one.
    if (wantsWeb(text)) return { via: 'keyword', ...(await webReply(models, text, warn)) };
    if (!models.isOn) {
      const can = { quickAnswers: false, proposals: where === 'local' };
      return { via: 'keyword', ...fallbackReply(match, JEV_OFF, can) };
    }
    return fromJev(text, match, projects);
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
          ? await fromText(request.text, request.pick)
          : await fromSkill(request.skill, request.pick);
      return { ...routed, jev: jevSwitch() };
    },
  };
}
