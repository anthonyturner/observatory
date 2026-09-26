import { RouteReply } from './assistant.types';
import { ReplyTier } from '../voice/reply-voice';

/** How a request ended: answered at a tier, failed, or left with options
 *  because the router was unsure. */
export type AskOutcome =
  | { readonly kind: 'answered'; readonly tier: ReplyTier }
  | { readonly kind: 'failed' }
  | { readonly kind: 'unsure' };

export const FAILED: AskOutcome = { kind: 'failed' };
const UNSURE: AskOutcome = { kind: 'unsure' };

/** The outcome of `reply`, decided the same way the feed decides what to show. */
export function outcomeOf(reply: RouteReply): AskOutcome {
  if (reply.tier === 1) return { kind: 'answered', tier: 1 };
  if (reply.tier === 2) return reply.failed ? FAILED : { kind: 'answered', tier: 2 };
  // A task that comes with options is asking which project to run it in.
  if (reply.tier === 3 && !reply.ask.length) return { kind: 'answered', tier: 3 };
  return UNSURE;
}
