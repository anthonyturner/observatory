import { LinkDefinitions } from './doc.types';

/** A page's lines ready to read as blocks, and the link definitions taken out of them. */
export interface DocSource {
  readonly lines: readonly string[];
  readonly definitions: LinkDefinitions;
}

export const FENCE = /^(\s*)(`{3,}|~{3,})\s*([^`\s]*)/;
const DEFINITION = /^ {0,3}\[([^\]]+)\]:\s*<?(\S+?)>?(?:\s+["'(].*["')])?\s*$/;
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';
const TAB_WIDTH = 4;
const LEADING_TABS = /^[ \t]+/;

const expandTabs = (line: string): string =>
  line.replace(LEADING_TABS, (lead) => lead.replace(/\t/g, ' '.repeat(TAB_WIDTH)));

/** One line with its HTML comments cut, carrying whether a comment is still open at its end. */
function uncommented(line: string, isOpen: boolean): { text: string; isOpen: boolean } {
  let text = '';
  let rest = line;
  let open = isOpen;
  while (rest) {
    const mark = open ? COMMENT_CLOSE : COMMENT_OPEN;
    const at = rest.indexOf(mark);
    if (at === -1) {
      if (!open) text += rest;
      break;
    }
    if (!open) text += rest.slice(0, at);
    rest = rest.slice(at + mark.length);
    open = !open;
  }
  return { text, isOpen: open };
}

/**
 * The page's lines with tabs expanded, HTML comments cut and reference link
 * definitions taken out, all outside code blocks, which keep every character.
 */
export function docSource(markdown: string): DocSource {
  const definitions = new Map<string, string>();
  const lines: string[] = [];
  let fence: string | null = null;
  let isInComment = false;
  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = expandTabs(raw);
    const marker = FENCE.exec(line)?.[2] ?? null;
    if (fence !== null || (marker !== null && !isInComment)) {
      if (fence === null) fence = marker;
      else if (marker !== null && marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null;
      }
      lines.push(line);
      continue;
    }
    const cut = uncommented(line, isInComment);
    isInComment = cut.isOpen;
    const definition = DEFINITION.exec(cut.text);
    if (definition) definitions.set(definition[1].trim().toLowerCase(), definition[2]);
    lines.push(definition ? '' : cut.text);
  }
  return { lines, definitions };
}
