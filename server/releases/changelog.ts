/** The section key Keep a Changelog gives work that has not shipped yet. */
export const UNRELEASED_KEY = 'unreleased';

/** `## [1.4.0] - 2026-03-01`, `## v1.4.0`, `## [Unreleased]`: the version is the first word. */
const SECTION_HEADING = /^##\s+\[?([^\]\s]+)\]?/;
/** The link definitions Keep a Changelog puts at the foot: `[1.4.0]: https://...`. */
const LINK_DEFINITION = /^\[[^\]]+\]:\s*\S+/;
const LEADING_V = /^v(?=\d)/i;

/** A version as a tag, a release title and a changelog heading can all spell it: `v1.4.0` is `1.4.0`. */
export const versionKey = (version: string): string =>
  version.trim().replace(LEADING_V, '').toLowerCase();

/**
 * Each `##` section of a changelog in Keep a Changelog's shape, by version key,
 * holding the markdown under its heading. A version listed twice keeps its
 * first section, the newer one in a file written newest first.
 */
export function changelogSections(text: string): ReadonlyMap<string, string> {
  const sections = new Map<string, string>();
  let key: string | null = null;
  let lines: string[] = [];
  const close = (): void => {
    const markdown = lines.join('\n').trim();
    if (key !== null && markdown && !sections.has(key)) sections.set(key, markdown);
  };
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(SECTION_HEADING);
    if (heading) {
      close();
      key = versionKey(heading[1]);
      lines = [];
    } else if (!LINK_DEFINITION.test(line)) {
      lines.push(line);
    }
  }
  close();
  return sections;
}
