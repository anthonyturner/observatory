import type { ChatRequest, ChatTurn } from '../assistant/chat-messages.ts';
import { OpenRouterError } from '../assistant/open-router-error.ts';
import type { RiskChange } from './risk-rules.ts';

/** What a one-line summary is written from: never the diff, so a summary stays cheap. */
export interface SummaryInput extends RiskChange {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  /** The commit the summary describes: a new push asks for a new one. */
  readonly headOid: string;
}

/** The model a summary comes from: OpenRouter's, which is off with no key. */
export interface SummaryModel {
  readonly isOn: boolean;
  chat(request: ChatRequest): Promise<ChatTurn>;
}

/** One-line summaries of pull requests, each kept for the head commit it describes. */
export interface RiskSummaries {
  /** False with no AI key: every summary is then null and nothing is asked. */
  readonly isOn: boolean;
  /** Null when there is no model, or it failed. */
  summaryOf(repo: string, pull: SummaryInput): Promise<string | null>;
}

/** Where no model is ever asked, as on the hosted site (ADR-0006). */
export const NO_SUMMARIES: RiskSummaries = { isOn: false, summaryOf: async () => null };

const SYSTEM =
  'You summarise a pull request for a reviewer glancing at it. Answer with one plain sentence of at ' +
  'most 20 words saying what it changes, starting with a verb. No preamble, no markdown, no quotes.';

/** Enough of a description to say what it is for, without paying for all of it. */
const MAX_BODY_CHARS = 1500;
const MAX_LISTED_FILES = 40;
const MAX_SUMMARY_CHARS = 200;
/** Each head commit's summary is kept; past this many the oldest goes first. */
const MAX_KEPT = 500;

const fileLine = (file: { path: string; additions: number; deletions: number }): string =>
  `${file.path} (+${file.additions} −${file.deletions})`;

/** The question for the model: the title, the start of the description, and the files. */
export function summaryRequest(pull: SummaryInput): ChatRequest {
  const listed = pull.files.slice(0, MAX_LISTED_FILES).map(fileLine);
  const unlisted = Math.max(pull.changedFiles, pull.files.length) - listed.length;
  const body = pull.body.trim().slice(0, MAX_BODY_CHARS);
  const text = [
    `Title: ${pull.title}`,
    `Description: ${body || '(none)'}`,
    `Files changed (+${pull.additions} −${pull.deletions} lines):`,
    ...listed,
    ...(unlisted > 0 ? [`…and ${unlisted} more files`] : []),
  ].join('\n');
  return {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: text },
    ],
    tools: [],
    toolChoice: 'none',
  };
}

/** The model's first line as a plain sentence, cut to fit a card; null for no words. */
export function oneLineOf(text: string): string | null {
  const line = text
    .split('\n')
    .map((each) => each.trim())
    .find(Boolean);
  if (!line) return null;
  const plain = line
    .replace(/\*\*|__|`/g, '')
    .replace(/^[-*#>\s]+/, '')
    .replace(/^summary:\s*/i, '')
    .replace(/^["“']+|["”']+$/g, '')
    .trim();
  if (plain.length <= MAX_SUMMARY_CHARS) return plain || null;
  const head = plain.slice(0, MAX_SUMMARY_CHARS - 1);
  return `${head.slice(0, head.lastIndexOf(' ')).trim()}…`;
}

/** Why a summary failed, in words safe to log: an OpenRouter error is already scrubbed of the key. */
const failureOf = (error: unknown): string =>
  error instanceof OpenRouterError ? error.message : 'an unexpected error';

/**
 * Summaries from `model`, one question per pull request and head commit. A
 * failure is logged and not kept, so the next look asks again.
 */
export function riskSummaries(
  model: SummaryModel,
  log: (line: string) => void = console.error,
): RiskSummaries {
  if (!model.isOn) return NO_SUMMARIES;
  const kept = new Map<string, Promise<string | null>>();

  const ask = async (pull: SummaryInput): Promise<string | null> =>
    oneLineOf((await model.chat(summaryRequest(pull))).text);

  return {
    isOn: true,
    summaryOf(repo, pull) {
      const key = `${repo}@${pull.headOid}`;
      let summary = kept.get(key);
      if (!summary) {
        if (kept.size >= MAX_KEPT) kept.delete(kept.keys().next().value ?? '');
        summary = ask(pull).catch((error: unknown) => {
          kept.delete(key);
          log(`Could not summarise ${repo}#${pull.number}: ${failureOf(error)}`);
          return null;
        });
        kept.set(key, summary);
      }
      return summary;
    },
  };
}
