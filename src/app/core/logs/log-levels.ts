import { FaultLevel } from './log-snapshot';

/** What a log star is: an error, a warning, or a window with neither. */
export type LogKey = FaultLevel | 'quiet';
/** The legend's filter: one kind of star lit, or everything. */
export type LogFilter = LogKey | null;

/** A colour per kind of star, as the caller's renderer takes colours. */
export type LogPalette = Readonly<Record<LogKey, string>>;

export interface LogLevelLook {
  readonly key: LogKey;
  /** The legend's words for it. */
  readonly label: string;
  /** Its colour in tokens.css. */
  readonly token: string;
}

/** The three kinds of log star, in the legend's order. */
export const LOG_LEVELS: readonly LogLevelLook[] = [
  { key: 'error', label: 'errors', token: '--log-error' },
  { key: 'warn', label: 'warnings', token: '--log-warn' },
  { key: 'quiet', label: 'quiet windows', token: '--log-quiet' },
];

/** A fault that fired this close to the newest log line is still burning. */
export const RECENT_DAYS = 3;
export const DAY_MS = 86_400_000;

/** A kind of star's colour as CSS, for the DOM parts. */
export const logColour = (key: LogKey): string =>
  `var(${LOG_LEVELS.find((look) => look.key === key)?.token ?? '--muted'})`;
