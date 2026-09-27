import type { AnswerReply, Reply, Source } from '../route-contract.ts';
import type { AgentRun } from './jev-agent.ts';

/** How a reply names Jev's own answers. */
const JEV_LABEL = 'Jev';

/** A reply with the pages it drew on, when there were any. */
export type SourcedReply = Reply & { readonly sources?: readonly Source[] };

/** What Jev chose to do, in the shapes the page already knows: a page to open
 *  or an op, with Jev's words as what it says; or a proposal, with them as its text. */
function effectReply(run: AgentRun): Reply | null {
  const { effect, text } = run;
  if (effect?.kind === 'proposal') return { ...effect.proposal, text };
  if (effect?.kind === 'action' && 'href' in effect.reply) {
    return { ...effect.reply, says: text || effect.reply.says };
  }
  return effect?.reply ?? null;
}

/** Jev's answer in words. Only a web search gives sources, so an answer with
 *  them is marked as one looked up on the web. */
function answerReply(run: AgentRun, by: string): AnswerReply {
  const answer: AnswerReply = { tier: 2, label: JEV_LABEL, by, text: run.text };
  return run.sources.length ? { ...answer, web: true } : answer;
}

/** The reply for what Jev did or said, with the pages its answer drew on. */
export function agentReply(run: AgentRun, by: string): SourcedReply {
  const reply = effectReply(run) ?? answerReply(run, by);
  return run.sources.length ? { ...reply, sources: run.sources } : reply;
}
