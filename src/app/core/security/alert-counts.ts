import { isNumber, isObject } from '../json/json-fields';
import type { AlertSeverity } from './security-report';

/*
 * The report's counts on their own. The tab badge on every project screen
 * reads only these, so this file stays free of the full report's checks,
 * which would otherwise ride in the bundle the app starts with.
 */

export const SECURITY_URL = '/api/security';

export type SeverityCounts = Readonly<Record<AlertSeverity, number>>;

const countOf = (value: unknown): number =>
  isNumber(value) && Number.isInteger(value) && value > 0 ? value : 0;

export function parseCounts(value: unknown): SeverityCounts {
  const counts = isObject(value) ? value : {};
  return {
    critical: countOf(counts['critical']),
    high: countOf(counts['high']),
    medium: countOf(counts['medium']),
    low: countOf(counts['low']),
  };
}

export const countsTotal = (counts: SeverityCounts): number =>
  counts.critical + counts.high + counts.medium + counts.low;

/** The open alerts an answer counts, from its lists' counts alone, or null when it is not a report. */
export function openAlertsIn(body: unknown): number | null {
  if (!isObject(body) || !Array.isArray(body['sources'])) return null;
  return body['sources'].reduce<number>(
    (total, source) => total + (isObject(source) ? countsTotal(parseCounts(source['counts'])) : 0),
    0,
  );
}
