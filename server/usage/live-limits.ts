import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { record } from './limit-recorder.ts';

// The status line is the only documented source of the plan limits, and it
// never runs in the VS Code extension. `/usage` reads this endpoint with the
// Claude Code sign-in, so the local API reads it too. It is undocumented: a
// change to it only stops these readings, and the status line still records.
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const OAUTH_BETA = 'oauth-2025-04-20';
const CREDENTIALS_FILE = join(homedir(), '.claude', '.credentials.json');

/** Home refreshes every minute; the limits need nothing like that. */
const MIN_READ_GAP_MS = 5 * 60_000;
const READ_TIMEOUT_MS = 10_000;

export interface LiveLimitSource {
  /** The Claude Code sign-in's access token, or null when signed out or expired. */
  readonly token: () => string | null;
  readonly fetch: typeof fetch;
}

function signedInToken(now = Date.now()): string | null {
  try {
    const credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8')) as {
      claudeAiOauth?: { accessToken?: unknown; expiresAt?: unknown };
    };
    const { accessToken, expiresAt } = credentials.claudeAiOauth ?? {};
    if (typeof accessToken !== 'string' || !accessToken) return null;
    return typeof expiresAt === 'number' && expiresAt <= now ? null : accessToken;
  } catch {
    return null;
  }
}

const DEFAULT_SOURCE: LiveLimitSource = { token: () => signedInToken(), fetch };

interface UsageWindow {
  readonly utilization?: unknown;
  readonly resets_at?: unknown;
}

const asStatusWindow = (window: UsageWindow | null | undefined) =>
  window && { used_percentage: window.utilization, resets_at: window.resets_at };

/** The endpoint's reply in the status line's `rate_limits` shape, which the recorder reads. */
export function statusOf(reply: unknown): { rate_limits: Record<string, unknown> } {
  const { seven_day: week, five_hour: five } = (reply ?? {}) as Record<string, UsageWindow | null>;
  return { rate_limits: { seven_day: asStatusWindow(week), five_hour: asStatusWindow(five) } };
}

/** Reads the limits once and hands them to the recorder; true when it kept
 *  the reading. A failed read is only a missing reading, so it never throws. */
export async function readLiveLimits(source = DEFAULT_SOURCE, now = Date.now()): Promise<boolean> {
  const token = source.token();
  if (!token) return false;
  try {
    const response = await source.fetch(USAGE_URL, {
      headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': OAUTH_BETA },
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    return record(statusOf(await response.json()), now);
  } catch {
    return false;
  }
}

/** A reader that reads at most once every few minutes, however often it is asked. */
export function throttledLiveLimits(
  read: () => Promise<unknown> = () => readLiveLimits(),
  gapMs = MIN_READ_GAP_MS,
): (now?: number) => Promise<void> {
  let lastAt = -Infinity;
  let pending: Promise<void> | null = null;
  return (now = Date.now()) => {
    if (pending) return pending;
    if (now - lastAt < gapMs) return Promise.resolve();
    lastAt = now;
    pending = read()
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => (pending = null));
    return pending;
  };
}
