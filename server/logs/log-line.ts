import type { LogLevel } from './log-types.ts';

// Overwolf writes one rotating file per window (`desktop.html.1463.log`), every
// line shaped `2026-09-23 01:43:37,307 (INFO) <source> (:1) - message`.

/** One timestamped line of a log. */
export interface LogLine {
  /** `2026-09-23`. */
  readonly day: string;
  /** `2026-09-23T01:43:37`, local to the machine that wrote it. */
  readonly at: string;
  readonly level: LogLevel;
  /** Everything after the level: the source and the message. */
  readonly rest: string;
}

/** A fault's message with what varies between occurrences taken out. */
export interface ShapedMessage {
  /** The `[Service]` the message opens with, if any. */
  readonly service: string | null;
  readonly text: string;
}

const LINE = /^﻿?(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}),\d+ \((\w+)\) (.*)$/;
const SOURCE = /^<[^>]*> \([^)]*\) - /;
const SERVICE = /^\[([^\]]{1,60})\]/;
const PAYLOAD = /\s(\{|\[\{|\[")[\s\S]*$/;
const URL_PATH = /https?:\/\/([^/\s'"]+)[^\s'"]*/g;
const NUMBER = /\d+(\.\d+)?/g;
const SPACES = /\s+/g;
/** Longer messages are cut here, with an ellipsis. */
const MAX_TEXT = 220;
const NEW_SESSION = '== new session ==';

/** The line's parts, or null for a line with no timestamp: a stack trace
 *  continuing the entry above it, not a new event. */
export function parseLogLine(raw: string): LogLine | null {
  const hit = LINE.exec(raw);
  if (!hit) return null;
  const [, day, time, level, rest] = hit;
  return { day, at: `${day}T${time}`, level: levelOf(level), rest };
}

export function levelOf(raw: string): LogLevel {
  const level = raw.toUpperCase();
  if (level.startsWith('ERR') || level === 'FATAL') return 'error';
  if (level.startsWith('WARN')) return 'warn';
  return 'info';
}

export const startsSession = (line: LogLine): boolean => line.rest.includes(NEW_SESSION);

/**
 * One message, stripped of what varies between occurrences of the same fault.
 *
 * Numbers, payloads and URL paths change every time; the fault does not. They
 * also carry most of the personal data a log holds (player ids, nicknames in
 * match payloads), so dropping them keeps that out of the page.
 */
export function shapeMessage(rest: string): ShapedMessage {
  const message = rest.replace(SOURCE, '');
  const service = SERVICE.exec(message)?.[1] ?? null;
  const text = message
    .replace(PAYLOAD, ' {…}')
    .replace(URL_PATH, 'https://$1/…')
    .replace(NUMBER, '#')
    .replace(SPACES, ' ')
    .trim();
  return { service, text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text };
}

/** `desktop.html.1463.log` and `desktop.html.log` are the same window: `desktop`. */
export const windowOf = (file: string): string =>
  file
    .replace(/\.log$/, '')
    .replace(/\.\d+$/, '')
    .replace(/\.html$/, '');
