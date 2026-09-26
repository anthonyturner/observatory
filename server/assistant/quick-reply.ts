import { OpenRouterError } from './open-router-error.ts';
import type { OpenRouter } from './open-router.ts';
import type { QuickReply } from './route-contract.ts';

const QUICK_LABEL = 'Quick answer';
const QUICK_OFF = 'quick answers are off: there is no OpenRouter key';

/** A tier-2 answer from the quick model, labelled as one, or why there is
 *  none. The failure is logged from the error's own message, which is scrubbed. */
export async function quickReply(
  models: OpenRouter,
  text: string,
  warn: (line: string) => void,
): Promise<QuickReply> {
  try {
    const { text: said, isCut } = await models.answer(text);
    return { tier: 2, label: QUICK_LABEL, by: models.quickLabel, text: isCut ? `${said}…` : said };
  } catch (error) {
    if (!(error instanceof OpenRouterError)) throw error;
    warn(error.message);
    return { tier: 2, failed: error.reason === 'key' && !models.isOn ? QUICK_OFF : error.words };
  }
}
