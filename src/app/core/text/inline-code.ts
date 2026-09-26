/** A run of plain text, or of `inline code`. */
export interface CodeSpan {
  readonly text: string;
  readonly isCode: boolean;
}

const CODE = /`([^`\n]+)`/;

/** Plain text with `inline code` and nothing else, the way a quick answer is
 *  drawn: no other markdown, and never any HTML. */
export function codeSpans(text: string): CodeSpan[] {
  return text
    .split(CODE)
    .map((part, index) => ({ text: part, isCode: index % 2 === 1 }))
    .filter((span) => span.text !== '');
}
