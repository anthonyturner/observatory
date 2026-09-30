import { rememberProjects, resolveProject } from './checkout-projects.ts';
import { messagesSince } from './log-cache.ts';
import { limitsFrom, readSamples } from './limit-windows.ts';
import { throttledLiveLimits } from './live-limits.ts';
import { type ProjectOf, projectUsage } from './project-usage.ts';
import { dayKeys, tokenDays, windowStart } from './token-days.ts';
import { modelUsage, tokenTotals, topTools } from './usage-breakdown.ts';
import { LOG_CACHE_FILE, SAMPLES_FILE, SESSION_LOGS_DIR } from './usage-paths.ts';
import type { UsageReport } from './usage-types.ts';

/** Days of tokens the report covers, today included. */
export const REPORT_DAYS = 30;

export interface UsageSources {
  readonly logsDir: string;
  readonly samplesFile: string;
  readonly cacheFile: string;
  /** Which project a session's working directory belongs to. */
  readonly projectOf: ProjectOf;
  /** Records a fresh limit reading before the samples are read, if it can. */
  readonly refreshLimits?: () => Promise<void>;
}

export const DEFAULT_SOURCES: UsageSources = {
  logsDir: SESSION_LOGS_DIR,
  samplesFile: SAMPLES_FILE,
  cacheFile: LOG_CACHE_FILE,
  projectOf: resolveProject,
  refreshLimits: throttledLiveLimits(),
};

/** Claude Code usage: the limit windows from the recorded readings, and a
 *  month of tokens from the session logs by day, model, tool and project. */
export async function usageReport(
  sources = DEFAULT_SOURCES,
  now = Date.now(),
): Promise<UsageReport> {
  await sources.refreshLimits?.();
  const messages = await messagesSince(
    sources.logsDir,
    windowStart(now, REPORT_DAYS),
    sources.cacheFile,
  );
  const days = dayKeys(now, REPORT_DAYS);
  const rows = tokenDays(messages, now, REPORT_DAYS);
  return {
    generatedAt: new Date(now).toISOString(),
    limits: limitsFrom(readSamples(sources.samplesFile), now),
    tokens: {
      days: REPORT_DAYS,
      from: days[0],
      rows,
      totals: tokenTotals(rows, messages),
      models: modelUsage(messages),
    },
    tools: topTools(messages),
    projects: projectUsage(messages, rememberProjects(sources.projectOf), days),
  };
}
