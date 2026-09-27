/** Words that ask for something only the web knows: news, the latest, a
 *  search. Plain enough to decide with no model call. An app action named in
 *  so many words is matched first, so "latest pull requests" still opens the queue. */
const WEB_WORDS = [
  /\bnews\b/,
  /\bheadlines?\b/,
  /\blatest\b/,
  /\bthis week\b/,
  /\bsearch (?:the )?(?:web|internet|online)\b/,
  /\b(?:look|search) (?:it |this |that )?up\b/,
  /\bon the (?:web|internet)\b/,
  /\bgoogle\b/,
] as const;

export function wantsWeb(text: string): boolean {
  const said = text.toLowerCase();
  return WEB_WORDS.some((words) => words.test(said));
}
