import { actionChoice, taskChoice } from './choices.ts';
import type { KeywordMatch } from './keyword-match.ts';
import type { AskReply } from './route-contract.ts';

/** What can still work here with no model to answer the request. */
export interface StillWorking {
  readonly proposals: boolean;
}

const MAX_FALLBACK_CHOICES = 3;

/** No model to ask, or it failed: offer the actions the request's words
 *  touch, and a task where one can still be proposed, saying why in `note`. */
export function fallbackReply(match: KeywordMatch, note: string, can: StillWorking): AskReply {
  const ask = [
    ...match.actions.map((id) => actionChoice(id, match.project)),
    ...(can.proposals ? [taskChoice(match.project)] : []),
  ];
  return {
    note,
    ask: ask.slice(0, MAX_FALLBACK_CHOICES),
    question: ask.length ? 'Did you mean:' : null,
  };
}
