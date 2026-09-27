import type { AnswerReply, Reply } from '../route-contract.ts';
import type { AgentRun } from './jev-agent.ts';

/** How a reply names Jev's own answers. */
export const JEV_LABEL = 'Jev';

/**
 * The reply for what Jev did, in the shapes the page already knows: a page to
 * open or an op, with Jev's words as what it says; a proposal, with them as
 * its text; or else Jev's answer in words.
 */
export function agentReply(run: AgentRun, by: string): Reply {
  const { effect, text } = run;
  if (effect?.kind === 'proposal') return { ...effect.proposal, text };
  if (effect?.kind === 'action' && 'href' in effect.reply) {
    return { ...effect.reply, says: text || effect.reply.says };
  }
  if (effect?.kind === 'action') return effect.reply;
  const answer: AnswerReply = { tier: 2, label: JEV_LABEL, by, text };
  return answer;
}
