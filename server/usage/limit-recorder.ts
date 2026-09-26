import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LAST_SAMPLE_FILE, SAMPLES_FILE } from './usage-paths.ts';
import type { LimitSample, WindowReading } from './usage-types.ts';

// Claude Code documents the plan limits for one program only: the status line
// command, as `rate_limits.seven_day` and `rate_limits.five_hour` on its stdin.
// The owner's status line script hands that JSON to `record()`.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** A reading that says nothing new is still kept this often, as a heartbeat. */
const HEARTBEAT_MS = 10 * MINUTE_MS;
/** This week and the eight before it. */
const KEEP_MS = 63 * DAY_MS;
/** Pruning rewrites the whole file, so it runs at most once a day. */
const PRUNE_EVERY_MS = DAY_MS;

export interface RecorderFiles {
  readonly samples: string;
  readonly last: string;
}

const DEFAULT_FILES: RecorderFiles = { samples: SAMPLES_FILE, last: LAST_SAMPLE_FILE };

interface LastSample extends LimitSample {
  readonly prunedAt: string | null;
}

/** Epoch seconds, as documented; a date string is read too, so a change of
 *  format does not silently stop the recording. */
function resetEpochMs(raw: unknown): number {
  if (typeof raw === 'number') return raw * 1000;
  if (typeof raw !== 'string' || !raw) return NaN;
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw);
}

function windowOf(raw: unknown): WindowReading | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { used_percentage: used, resets_at: resets } = raw as Record<string, unknown>;
  // Number(null) is 0: a missing figure must stay missing, not read as unused.
  if (typeof used !== 'number' && typeof used !== 'string') return null;
  const pct = Number(used);
  const resetsAt = resetEpochMs(resets);
  if (!Number.isFinite(pct) || !Number.isFinite(resetsAt)) return null;
  return { pct: Math.round(pct * 10) / 10, resetsAt: new Date(resetsAt).toISOString() };
}

/** One reading from the status line's JSON, or null when it carries no limits. */
export function sampleOf(status: unknown, now: number): LimitSample | null {
  const limits = (status as { rate_limits?: Record<string, unknown> } | null)?.rate_limits;
  const week = windowOf(limits?.['seven_day']);
  const five = windowOf(limits?.['five_hour']);
  if (!week && !five) return null;
  return { at: new Date(now).toISOString(), week, five };
}

const sameWindow = (a: WindowReading | null, b: WindowReading | null): boolean =>
  (a?.pct ?? null) === (b?.pct ?? null) && (a?.resetsAt ?? null) === (b?.resetsAt ?? null);

function readLast(file: string): LastSample | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as LastSample;
  } catch {
    return null;
  }
}

function prune(file: string, now: number): void {
  const cutoff = new Date(now - KEEP_MS).toISOString();
  const kept = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => {
      try {
        return (JSON.parse(line) as LimitSample).at >= cutoff;
      } catch {
        return false;
      }
    });
  writeFileSync(file, kept.length ? `${kept.join('\n')}\n` : '', 'utf8');
}

/**
 * Keeps a reading when it says something new or the heartbeat is due, and
 * returns whether it did. The status line runs every few seconds in every
 * session, so this never throws: a broken recorder must not blank it.
 */
export function record(status: unknown, now = Date.now(), files = DEFAULT_FILES): boolean {
  try {
    const sample = sampleOf(status, now);
    if (!sample) return false;
    const last = readLast(files.last);
    const heartbeatDue = !last || now - Date.parse(last.at) >= HEARTBEAT_MS;
    const unchanged =
      last && sameWindow(last.week, sample.week) && sameWindow(last.five, sample.five);
    if (!heartbeatDue && unchanged) return false;

    mkdirSync(dirname(files.samples), { recursive: true });
    appendFileSync(files.samples, `${JSON.stringify(sample)}\n`, 'utf8');
    let prunedAt = last?.prunedAt ?? null;
    if (!prunedAt || now - Date.parse(prunedAt) >= PRUNE_EVERY_MS) {
      prune(files.samples, now);
      prunedAt = new Date(now).toISOString();
    }
    writeFileSync(files.last, JSON.stringify({ ...sample, prunedAt }), 'utf8');
    return true;
  } catch {
    return false;
  }
}
