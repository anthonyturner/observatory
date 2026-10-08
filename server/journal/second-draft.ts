import { PRINCIPLES } from '../principles/principles.ts';

/** One lesson from a review: what was built, what the review said, what changed, and what it taught. */
export interface SecondDraft {
  readonly firstVersion: string;
  readonly feedback: string;
  /** What changed on the redo, and why. */
  readonly change: string;
  /** Ids from `server/principles`, in the order written, each once. */
  readonly principles: readonly string[];
}

type Field = 'firstVersion' | 'feedback' | 'change' | 'principles';

/** The label each field answers to, as docs/agent-workflows/qa-review.md names them. */
const FIELD_LABELS: Readonly<Record<string, Field>> = {
  'first version': 'firstVersion',
  feedback: 'feedback',
  'changed and why': 'change',
  'what changed and why': 'change',
  changed: 'change',
  'what changed': 'change',
  principle: 'principles',
  principles: 'principles',
};

const PRINCIPLE_IDS: ReadonlySet<string> = new Set(PRINCIPLES.map((principle) => principle.id));

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const SECOND_DRAFT_HEADING = /^second draft\b/i;
/** `- **First version:** text`, `First version: text` and `**Feedback**: text`, bullet and bold optional. */
const LABELLED_LINE = new RegExp(
  `^\\s*(?:[-*+]\\s+)?(?:\\*\\*|__)?(${Object.keys(FIELD_LABELS).join('|')})(?:\\*\\*|__)?\\s*:\\s*(?:\\*\\*|__)?\\s*(.*)$`,
  'i',
);
const ID_TOKEN = /[a-z][a-z0-9-]*/g;

type Fields = Partial<Record<Field, string>>;

const CODE_FENCE = /^\s*(```|~~~)/;

/**
 * The lines under each `Second draft` heading, up to the next heading as high
 * or higher. Fenced code is skipped whole: a review quoting the format in a
 * fence is explaining it, not recording a lesson.
 */
function sectionLines(markdown: string): string[] {
  const lines: string[] = [];
  let headingLevel = 0;
  let isFenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (CODE_FENCE.test(line)) {
      isFenced = !isFenced;
      continue;
    }
    if (isFenced) continue;
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (SECOND_DRAFT_HEADING.test(heading[2])) headingLevel = level;
      else if (level <= headingLevel) headingLevel = 0;
    } else if (headingLevel > 0) {
      lines.push(line);
    }
  }
  return lines;
}

/** Ids named anywhere in `text`, whatever surrounds them (commas, backticks, "and"); unknown words are not ids. */
function principleIdsIn(text: string): string[] {
  const named = text.toLowerCase().match(ID_TOKEN) ?? [];
  return [...new Set(named.filter((word) => PRINCIPLE_IDS.has(word)))];
}

function draftOf(fields: Fields): SecondDraft | null {
  const { firstVersion, feedback, change } = fields;
  if (!firstVersion || !feedback || !change) return null;
  return { firstVersion, feedback, change, principles: principleIdsIn(fields.principles ?? '') };
}

/**
 * The lessons written under a `## Second draft` heading in a review comment.
 * An entry starts at each `First version:` line. One missing a field is left
 * out, and a comment without the section has none, so nothing here throws.
 */
export function secondDraftsIn(markdown: string): SecondDraft[] {
  const drafts: SecondDraft[] = [];
  let fields: Fields = {};
  let current: Field | null = null;
  const finish = (): void => {
    const draft = draftOf(fields);
    if (draft) drafts.push(draft);
    fields = {};
  };

  for (const line of sectionLines(markdown)) {
    const labelled = LABELLED_LINE.exec(line);
    if (labelled) {
      current = FIELD_LABELS[labelled[1].toLowerCase()];
      if (current === 'firstVersion' && fields.firstVersion !== undefined) finish();
      fields[current] = labelled[2].trim();
    } else if (current) {
      fields[current] = `${fields[current] ?? ''}\n${line.trim()}`.trim();
    }
  }
  finish();
  return drafts;
}
