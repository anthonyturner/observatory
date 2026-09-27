import { OpenRouterError } from './open-router-error.ts';
import type { OpenRouter } from './open-router.ts';
import type { QuickReply } from './route-contract.ts';

const WEB_LABEL = 'Web answer';
const WEB_OFF = 'web lookups are off: there is no OpenRouter key';

/** A tier-2 answer looked up on the web, with the pages it drew on, or why
 *  there is none. The failure is logged from the error's own message, which is scrubbed. */
export async function webReply(
  models: OpenRouter,
  text: string,
  warn: (line: string) => void,
): Promise<QuickReply> {
  try {
    const { text: said, isCut, sources } = await models.search(text);
    return {
      tier: 2,
      web: true,
      label: WEB_LABEL,
      by: models.webLabel,
      text: isCut ? `${said}…` : said,
      sources,
    };
  } catch (error) {
    if (!(error instanceof OpenRouterError)) throw error;
    warn(error.message);
    return {
      tier: 2,
      web: true,
      failed: error.reason === 'key' && !models.isOn ? WEB_OFF : error.words,
    };
  }
}
