/** A custom element's tag: a letter, then letters, digits and at least one hyphen. */
const CUSTOM_TAG = /<([a-z][a-z0-9]*-[a-z0-9-]*)/gi;
const LEADING_ELEMENT = /^[a-z][a-z0-9]*-[a-z0-9-]*/i;

/** Each custom element tag an Angular template opens, once, in lower case. */
export function tagsIn(template: string): string[] {
  const tags = [...template.matchAll(CUSTOM_TAG)].map((match) => (match[1] ?? '').toLowerCase());
  return [...new Set(tags)];
}

/**
 * The element a component selector matches, from its first alternative;
 * null for a selector that matches attributes or classes only, as a directive's does.
 */
export function elementOf(selector: string): string | null {
  const [first = ''] = selector.split(',');
  return LEADING_ELEMENT.exec(first.trim())?.[0].toLowerCase() ?? null;
}
