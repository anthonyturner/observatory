import { messagesSince } from './log-cache.ts';
import { limitsFrom, readSamples } from './limit-windows.ts';
import { tokenDays, windowStart } from './token-days.ts';
import { LOG_CACHE_FILE, SAMPLES_FILE, SESSION_LOGS_DIR } from './usage-paths.ts';
import type { UsageReport } from './usage-types.ts';

/** Days of tokens the report covers, today included. */
export const REPORT_DAYS = 30;

export interface UsageSources {
  readonly logsDir: string;
  readonly samplesFile: string;
  readonly cacheFile: string;
}

export const DEFAULT_SOURCES: UsageSources = {
  logsDir: SESSION_LOGS_DIR,
  samplesFile: SAMPLES_FILE,
  cacheFile: LOG_CACHE_FILE,
};

/** Claude Code usage as the meters read it: the limit windows from the
 *  recorded readings, and each day's tokens from the session logs. */
export async function usageReport(
  sources = DEFAULT_SOURCES,
  now = Date.now(),
): Promise<UsageReport> {
  const messages = await messagesSince(
    sources.logsDir,
    windowStart(now, REPORT_DAYS),
    sources.cacheFile,
  );
  return {
    generatedAt: new Date(now).toISOString(),
    limits: limitsFrom(readSamples(sources.samplesFile), now),
    tokens: { days: REPORT_DAYS, rows: tokenDays(messages, now, REPORT_DAYS) },
  };
}
