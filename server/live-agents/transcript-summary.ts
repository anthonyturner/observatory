import {
  type Block,
  type TranscriptLine,
  blocksOf,
  isBlock,
  parseLine,
  text,
  textsOf,
  timeOf,
} from './transcript-lines.ts';

/** What the live list needs from the end of a transcript. */
export interface TranscriptSummary {
  /** The folder it last worked in, as the latest line that names one says. */
  readonly cwd: string | null;
  readonly branch: string | null;
  readonly lastLineAt: number | null;
  /** The latest title Claude Code gave the session. */
  readonly title: string | null;
  /** Holds at least one prompt or reply, so it is a conversation and not bookkeeping. */
  readonly isConversation: boolean;
  /** The last reply ended its turn, or the user interrupted it. */
  readonly isTurnEnded: boolean;
  readonly lastTool: string | null;
  readonly isHeadless: boolean;
}

/** `claude -p`, as Claude Code records it. */
const HEADLESS_ENTRYPOINT = 'sdk-cli';
const END_TURN = 'end_turn';
const INTERRUPTED = '[Request interrupted by user';
/** The input that says what a call was aimed at, most telling first. */
const TOOL_TARGETS = ['file_path', 'path', 'command', 'pattern', 'url', 'query', 'description'];
const LAST_TOOL_CHARS = 200;

const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

const clipped = (value: string): string =>
  value.length > LAST_TOOL_CHARS ? `${value.slice(0, LAST_TOOL_CHARS - 1)}…` : value;

/** `Read src/app.ts`: the tool, and what its input says it was aimed at. */
export function toolCallOf(block: Block): string | null {
  const name = text(block['name']);
  if (!name) return null;
  const input = isBlock(block['input']) ? block['input'] : {};
  const target = TOOL_TARGETS.map((key) => text(input[key])).find((value) => value !== null);
  return clipped(oneLine(target ? `${name} ${target}` : name));
}

/** The summary as it is built, one line at a time. */
class Reading implements TranscriptSummary {
  cwd: string | null = null;
  branch: string | null = null;
  lastLineAt: number | null = null;
  title: string | null = null;
  isConversation = false;
  isTurnEnded = false;
  lastTool: string | null = null;
  isHeadless = false;

  take(line: TranscriptLine): void {
    const at = timeOf(line);
    if (at !== null) this.lastLineAt = Math.max(this.lastLineAt ?? at, at);
    this.cwd = text(line.cwd) ?? this.cwd;
    this.branch = text(line.gitBranch) ?? this.branch;
    this.title = text(line.aiTitle) ?? this.title;
    const entrypoint = text(line.entrypoint);
    if (entrypoint) this.isHeadless = entrypoint === HEADLESS_ENTRYPOINT;
    if (line.type === 'assistant') this.takeReply(line);
    if (line.type === 'user') this.takePrompt(line);
  }

  private takeReply(line: TranscriptLine): void {
    this.isConversation = true;
    this.isTurnEnded = line.message?.stop_reason === END_TURN;
    for (const block of blocksOf(line.message?.content)) {
      if (block['type'] === 'tool_use') this.lastTool = toolCallOf(block) ?? this.lastTool;
    }
  }

  private takePrompt(line: TranscriptLine): void {
    this.isConversation = true;
    if (line.isMeta === true) return;
    const said = textsOf(line.message?.content);
    this.isTurnEnded = said.some((words) => words.startsWith(INTERRUPTED));
  }
}

/** What `lines`, a transcript's last lines in order, say about its agent. */
export function summaryOf(lines: readonly string[]): TranscriptSummary {
  const reading = new Reading();
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) reading.take(parsed);
  }
  const { cwd, branch, lastLineAt, title, isConversation, isTurnEnded, lastTool, isHeadless } =
    reading;
  return { cwd, branch, lastLineAt, title, isConversation, isTurnEnded, lastTool, isHeadless };
}
