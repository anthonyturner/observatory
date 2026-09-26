const BEARER = /\bBearer\s+\S+/gi;
const OPENROUTER_KEY = /\bsk-or-[\w-]+/g;
const HIDDEN = '[key]';

/** Text with anything that could echo a key back blanked: `key` itself, any
 *  bearer value, and anything shaped like an OpenRouter key. */
export function keyScrubber(key: string | null): (text: unknown) => string {
  return (text) => {
    const said = String(text ?? '');
    const withoutKey = key ? said.split(key).join(HIDDEN) : said;
    return withoutKey.replace(BEARER, `Bearer ${HIDDEN}`).replace(OPENROUTER_KEY, HIDDEN);
  };
}
