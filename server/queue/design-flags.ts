import { type Hunk, hunksOf } from './diff-hunks.ts';
import { type MaskedSource, maskSource } from './code-mask.ts';
import { isTestOrDocPath } from './risk-rules.ts';

/**
 * The red flags of docs/design-principles.md a diff scan can find:
 * an error a `catch` discards, a TODO with no issue to follow it up, a method
 * that only forwards to another, and a lint or type check switched off.
 */
export const FLAG_KINDS = [
  'swallowed-error',
  'pass-through',
  'silenced-check',
  'untracked-todo',
] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

/** One red flag on one added line. */
export interface DesignFlag {
  readonly kind: FlagKind;
  readonly path: string;
  /** Its line number in the new file. */
  readonly line: number;
  /** What was found, in a few words: "empty catch", "`read` only forwards to `store.read`". */
  readonly note: string;
  /** The added line, trimmed and cut short. */
  readonly excerpt: string;
}

/** Past this many a pull request is a storm whatever the rest say; the answer stays small. */
export const MAX_FLAGS = 100;
const MAX_EXCERPT_CHARS = 120;

/** TypeScript and JavaScript, not declarations or bundles. */
const CODE_FILE = /\.[cm]?[jt]sx?$/;
const NOT_SOURCE = /\.d\.[cm]?ts$|\.min\.js$/;

/** A finding at an offset into a hunk's text, before it is placed on a line. */
interface Finding {
  readonly kind: FlagKind;
  readonly at: number;
  readonly note: string;
}

/** A hunk's new side as one text, split into code and comments. */
interface ScannedHunk extends MaskedSource {
  readonly text: string;
}

const IDENTIFIER = '[A-Za-z_$][\\w$]*';
const isIdentifier = (text: string): boolean => new RegExp(`^${IDENTIFIER}$`).test(text);
/** `name` used as a word in `text`, not as part of a longer name or a property of something else. */
const uses = (text: string, name: string): boolean =>
  new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);

/** The offset of the bracket that closes the one at `open`, or -1 when the hunk ends first. */
function closeOf(code: string, open: number): number {
  const pairs: Readonly<Record<string, string>> = { '{': '}', '(': ')', '[': ']' };
  const stack: string[] = [];
  for (let i = open; i < code.length; i++) {
    const char = code[i];
    if (pairs[char]) stack.push(pairs[char]);
    else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return -1;
}

/* ---- A catch that discards the error ---- */

const TRY_CATCH = new RegExp(
  `(?<![\\w$.])catch\\s*(?:\\(\\s*(${IDENTIFIER})\\s*(?::[^)]*)?\\))?\\s*\\{`,
  'g',
);
const PROMISE_CATCH = /\.\s*catch\s*\(/g;
const ARROW_HANDLER = new RegExp(
  `^(?:async\\s*)?(?:\\(\\s*(${IDENTIFIER})?\\s*(?::[^)]*)?\\)|(${IDENTIFIER}))\\s*=>\\s*([\\s\\S]*)$`,
);
const FUNCTION_HANDLER = new RegExp(
  `^(?:async\\s+)?function\\s*(?:${IDENTIFIER})?\\s*\\(\\s*(${IDENTIFIER})?[^)]*\\)\\s*\\{([\\s\\S]*)\\}$`,
);
/** An expression that gives nothing back: the handler only quiets the error. */
const NOTHING = /^(?:undefined|null|void 0|\{\s*\})$/;
const NOOP_HANDLER = /^(?:noop|_\.noop)$/;

/** Why a handler with `error` bound (or none) and `body` discards the error, or null when it does not. */
function discardOf(error: string | undefined, body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed || NOTHING.test(trimmed)) return 'empty catch';
  // A catch with no name for the error chose to drop it; only a named one left unused is a slip.
  if (error && !uses(trimmed, error)) return `error \`${error}\` is never used`;
  return null;
}

function tryCatches(code: string): Finding[] {
  const found: Finding[] = [];
  for (const match of code.matchAll(TRY_CATCH)) {
    const open = match.index + match[0].length - 1;
    const close = closeOf(code, open);
    if (close < 0) continue;
    const note = discardOf(match[1], code.slice(open + 1, close));
    if (note) found.push({ kind: 'swallowed-error', at: match.index, note });
  }
  return found;
}

/** The parameter and body of a `.catch(…)` handler, when it is written inline. */
function handlerOf(argument: string): { error: string | undefined; body: string } | null {
  const arrow = ARROW_HANDLER.exec(argument);
  if (arrow) {
    const body = arrow[3].trim();
    const isBlock = body.startsWith('{') && body.endsWith('}');
    return { error: arrow[1] ?? arrow[2], body: isBlock ? body.slice(1, -1) : body };
  }
  const named = FUNCTION_HANDLER.exec(argument);
  return named ? { error: named[1], body: named[2] } : null;
}

function promiseCatches(code: string): Finding[] {
  const found: Finding[] = [];
  for (const match of code.matchAll(PROMISE_CATCH)) {
    const open = match.index + match[0].length - 1;
    const close = closeOf(code, open);
    if (close < 0) continue;
    const argument = code.slice(open + 1, close).trim();
    const at = code.indexOf('catch', match.index);
    if (NOOP_HANDLER.test(argument)) {
      found.push({ kind: 'swallowed-error', at, note: 'empty catch' });
      continue;
    }
    const handler = handlerOf(argument);
    const note = handler && discardOf(handler.error, handler.body);
    if (note) found.push({ kind: 'swallowed-error', at, note });
  }
  return found;
}

/* ---- A method that only forwards ---- */

const CALLEE = `((?:this\\.)?${IDENTIFIER}(?:\\??\\.${IDENTIFIER})+)`;
const NOT_NAMES: ReadonlySet<string> = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'with',
  'function',
  'return',
]);
/** `name(a, b) { return other.name(a, b); }`, as a method or a function. */
const FORWARDING_METHOD = new RegExp(
  `(?<![\\w$.])(?:(?:public|private|protected|static|async|override)\\s+)*(?:function\\s+)?` +
    `(${IDENTIFIER})\\s*(?:<[^<>(){}]*>)?\\s*\\(([^()]*)\\)\\s*(?::\\s*[^{};=()]+?)?\\s*` +
    `\\{\\s*return\\s+(?:await\\s+)?${CALLEE}\\s*\\(([^()]*)\\)\\s*;?\\s*\\}`,
  'g',
);
/** `name = (a, b) => other.name(a, b)`, or `name: (a) => …` in an object. */
const FORWARDING_ARROW = new RegExp(
  `(?<![\\w$.])(${IDENTIFIER})\\s*[:=]\\s*(?:async\\s+)?\\(([^()]*)\\)\\s*(?::\\s*[^{};=()]+?)?\\s*=>\\s*` +
    `(?:\\{\\s*return\\s+)?(?:await\\s+)?${CALLEE}\\s*\\(([^()]*)\\)(?=\\s*;?\\s*[,;})\\n]|\\s*$)`,
  'g',
);

const listOf = (text: string): string[] =>
  text.trim() ? text.split(',').map((part) => part.trim()) : [];

/** The plain names of a parameter list, or null when one is destructured or spread. */
function namesOf(parameters: string): string[] | null {
  const names = listOf(parameters).map((each) => each.split(/[?:=]/)[0].trim());
  return names.every(isIdentifier) ? names : null;
}

/**
 * Whether `callee` is another object's method of the same name: the shape of
 * a pass-through. A call to a differently named method usually adapts one
 * interface to another, and `this.name` alone binds a method as a callback.
 */
function isNamesake(name: string, callee: string): boolean {
  const parts = callee.replace(/\?\./g, '.').split('.');
  const isOwnMethod = parts.length === 2 && parts[0] === 'this';
  return parts[parts.length - 1] === name && !isOwnMethod;
}

/** Whether a call passes exactly the parameters it was given, in order. */
function forwardsAll(parameters: string, argumentList: string): boolean {
  const names = namesOf(parameters);
  const passed = listOf(argumentList);
  return (
    !!names?.length &&
    names.length === passed.length &&
    names.every((name, n) => name === passed[n])
  );
}

function passThroughs(code: string): Finding[] {
  const found: Finding[] = [];
  for (const pattern of [FORWARDING_METHOD, FORWARDING_ARROW]) {
    for (const match of code.matchAll(pattern)) {
      const [, name, parameters, callee, argumentList] = match;
      if (NOT_NAMES.has(name) || !isNamesake(name, callee)) continue;
      if (!forwardsAll(parameters, argumentList)) continue;
      const at = match.index + match[0].indexOf(name);
      found.push({ kind: 'pass-through', at, note: `\`${name}\` only forwards to \`${callee}\`` });
    }
  }
  return found;
}

/* ---- Comments: a TODO with no issue, a check switched off ---- */

const TODO = /\b(TODO|FIXME|HACK|XXX)\b/;
/** `#123`, an issues link, or a tracker key such as `OBS-42`. */
const ISSUE_REFERENCE = /#\d+|\/issues\/\d+|\b[A-Z][A-Z0-9]+-\d+\b/;
const ESLINT_OFF = /eslint-disable(?:-next-line|-line)?\b/;
const ESLINT_REASON = /eslint-disable\S*[^\n]*?\s--\s*\S/;
const TS_OFF = /@ts-(ignore|nocheck)\b/;

/** What one line's comment flags, given the whole line for its issue reference. */
function commentFindings(comment: string, line: string, at: number): Finding[] {
  const found: Finding[] = [];
  const todo = TODO.exec(comment);
  if (todo && !ISSUE_REFERENCE.test(line)) {
    found.push({ kind: 'untracked-todo', at: at + todo.index, note: `${todo[1]} with no issue` });
  }
  const eslint = ESLINT_OFF.exec(comment);
  if (eslint && !ESLINT_REASON.test(comment)) {
    found.push({ kind: 'silenced-check', at: at + eslint.index, note: 'lint rule off, no reason' });
  }
  const ts = TS_OFF.exec(comment);
  if (ts) found.push({ kind: 'silenced-check', at: at + ts.index, note: `@ts-${ts[1]}` });
  return found;
}

function commentsFlagged(hunk: ScannedHunk): Finding[] {
  const found: Finding[] = [];
  let at = 0;
  const lines = hunk.text.split('\n');
  const comments = hunk.comments.split('\n');
  lines.forEach((line, n) => {
    if (comments[n].trim()) found.push(...commentFindings(comments[n], line, at));
    at += line.length + 1;
  });
  return found;
}

/* ---- Putting findings on lines ---- */

const isScanned = (path: string): boolean =>
  CODE_FILE.test(path) && !NOT_SOURCE.test(path) && !isTestOrDocPath(path);

const excerptOf = (text: string): string => {
  const trimmed = text.trim();
  return trimmed.length <= MAX_EXCERPT_CHARS
    ? trimmed
    : `${trimmed.slice(0, MAX_EXCERPT_CHARS - 1)}…`;
};

/** The hunk line an offset falls on. */
function lineAt(starts: readonly number[], at: number): number {
  let n = 0;
  while (n + 1 < starts.length && starts[n + 1] <= at) n++;
  return n;
}

function flagsOfHunk(hunk: Hunk): DesignFlag[] {
  const text = hunk.lines.map((line) => line.text).join('\n');
  const scanned: ScannedHunk = { text, ...maskSource(text) };
  const findings = [
    ...tryCatches(scanned.code),
    ...promiseCatches(scanned.code),
    ...passThroughs(scanned.code),
    ...commentsFlagged(scanned),
  ];
  const starts: number[] = [];
  let offset = 0;
  for (const line of hunk.lines) {
    starts.push(offset);
    offset += line.text.length + 1;
  }
  const seen = new Set<string>();
  const flags: DesignFlag[] = [];
  for (const finding of findings) {
    const line = hunk.lines[lineAt(starts, finding.at)];
    const key = `${finding.kind}:${line.line}`;
    if (!line.isAdded || seen.has(key)) continue;
    seen.add(key);
    flags.push({
      kind: finding.kind,
      path: hunk.path,
      line: line.line,
      note: finding.note,
      excerpt: excerptOf(line.text),
    });
  }
  return flags.sort((a, b) => a.line - b.line);
}

/**
 * The design red flags in what a unified diff adds to TypeScript and
 * JavaScript, tests aside. These are heuristics read from patterns, not a
 * parse, tuned to miss a flag rather than raise a false one: a block whose
 * end lies outside the diff's context is passed over, and only added lines
 * are ever flagged. At most MAX_FLAGS, in file order.
 */
export function designFlagsOf(diff: string): DesignFlag[] {
  return hunksOf(diff)
    .filter((hunk) => isScanned(hunk.path))
    .flatMap(flagsOfHunk)
    .slice(0, MAX_FLAGS);
}
