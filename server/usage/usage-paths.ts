import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where Claude Code writes its session logs, one folder per working directory. */
export const SESSION_LOGS_DIR = join(homedir(), '.claude', 'projects');

/** Observatory's own usage files: limit readings and the log cache. */
export const USAGE_DIR = join(homedir(), '.claude', 'observatory', 'usage');
export const SAMPLES_FILE = join(USAGE_DIR, 'samples.jsonl');
export const LAST_SAMPLE_FILE = join(USAGE_DIR, 'last.json');
export const LOG_CACHE_FILE = join(USAGE_DIR, 'log-cache.json');
