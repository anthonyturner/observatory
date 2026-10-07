/* One line of a Claude Code transcript. Claude Code calls the format internal,
   so every field is read as optional: a changed format shows as a blank or
   "unknown", never as a crash. */

export interface TranscriptLine {
  readonly type?: unknown;
  readonly timestamp?: unknown;
  readonly cwd?: unknown;
  readonly gitBranch?: unknown;
  readonly entrypoint?: unknown;
  readonly aiTitle?: unknown;
  readonly isMeta?: unknown;
  readonly content?: unknown;
  readonly toolUseResult?: unknown;
  readonly message?: { readonly stop_reason?: unknown; readonly content?: unknown };
}

export type Block = Readonly<Record<string, unknown>>;

export const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

export const isBlock = (value: unknown): value is Block =>
  typeof value === 'object' && value !== null;

export const blocksOf = (content: unknown): Block[] =>
  Array.isArray(content) ? content.filter(isBlock) : [];

/** The plain text a line carries: a string, or its text blocks. */
export function textsOf(content: unknown): string[] {
  if (typeof content === 'string') return [content];
  return blocksOf(content).flatMap((block) =>
    block['type'] === 'text' ? [text(block['text']) ?? ''] : [],
  );
}

/** The line as an object, or null for one that will not parse, such as one still being written. */
export function parseLine(line: string): TranscriptLine | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return isBlock(parsed) ? (parsed as TranscriptLine) : null;
  } catch {
    return null;
  }
}

/** When the line was written, or null when it does not say. */
export function timeOf(line: TranscriptLine): number | null {
  const at = Date.parse(String(line.timestamp));
  return Number.isFinite(at) ? at : null;
}
