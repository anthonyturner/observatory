import { gitHubLinkOf, timeOf } from '../actions/actions-report';
import { isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';
import { SeverityCounts, countsTotal, parseCounts } from './alert-counts';

export type { SeverityCounts } from './alert-counts';

/** Which of GitHub's three alert lists an alert came from. */
export type AlertKind = 'dependabot' | 'code-scanning' | 'secret-scanning';
export const ALERT_KINDS: readonly AlertKind[] = ['dependabot', 'code-scanning', 'secret-scanning'];

/** Most severe first. */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export const SEVERITIES: readonly AlertSeverity[] = ['critical', 'high', 'medium', 'low'];

/** Read, or why not: switched `off`, the token has `no-access`, or GitHub `failed`. */
export type SourceStatus = 'read' | 'off' | 'no-access' | 'failed';
const SOURCE_STATUSES: readonly SourceStatus[] = ['read', 'off', 'no-access', 'failed'];

export interface AlertSource {
  readonly kind: AlertKind;
  readonly status: SourceStatus;
  /** Why nothing was read, in a line; null when it was. */
  readonly note: string | null;
  readonly counts: SeverityCounts;
}

export interface SecurityAlert {
  readonly kind: AlertKind;
  readonly number: number;
  readonly severity: AlertSeverity;
  readonly title: string;
  /** The package and manifest, or the file and line; empty when GitHub gave none. */
  readonly where: string;
  /** Milliseconds since the epoch. */
  readonly createdAt: number;
  readonly url: string;
}

/** What `GET /api/security` returns. */
export interface SecurityReport {
  readonly generatedAt: number;
  readonly repo: string;
  readonly sources: readonly AlertSource[];
  /** Most severe first. Empty when withheld. */
  readonly alerts: readonly SecurityAlert[];
  /** A preview visitor gets the counts only. */
  readonly isWithheld: boolean;
}

const isAlertKind = oneOf(ALERT_KINDS);
const isSeverity = oneOf(SEVERITIES);
const isSourceStatus = oneOf(SOURCE_STATUSES);

function parseSource(value: unknown): AlertSource | null {
  if (!isObject(value) || !isAlertKind(value['kind']) || !isSourceStatus(value['status'])) {
    return null;
  }
  return {
    kind: value['kind'],
    status: value['status'],
    note: isText(value['note']) ? value['note'] : null,
    counts: parseCounts(value['counts']),
  };
}

function parseAlert(value: unknown): SecurityAlert | null {
  if (!isObject(value)) return null;
  const { kind, number, severity, title } = value;
  const createdAt = timeOf(value['createdAt']);
  const url = gitHubLinkOf(value['url']);
  if (!isAlertKind(kind) || !isNumber(number) || !isSeverity(severity) || !isText(title)) {
    return null;
  }
  if (createdAt === null || !url) return null;
  const where = isText(value['where']) ? value['where'] : '';
  return { kind, number, severity, title, where, createdAt, url };
}

/** The report, checked field by field, or null when the answer is not one. */
export function parseSecurityReport(body: unknown): SecurityReport | null {
  if (!isObject(body) || !isText(body['repo'])) return null;
  const generatedAt = timeOf(body['generatedAt']);
  if (generatedAt === null) return null;
  return {
    generatedAt,
    repo: body['repo'],
    sources: listOf(body['sources'], parseSource),
    alerts: listOf(body['alerts'], parseAlert),
    isWithheld: body['isWithheld'] === true,
  };
}

/** Every open alert the report counted, withheld or not. */
export const openAlertCount = (report: SecurityReport): number =>
  report.sources.reduce((total, source) => total + countsTotal(source.counts), 0);

/** The most severe grade with an open alert, or null for none. */
export function worstSeverity(report: SecurityReport): AlertSeverity | null {
  return (
    SEVERITIES.find((severity) => report.sources.some((source) => source.counts[severity] > 0)) ??
    null
  );
}
