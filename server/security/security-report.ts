import type {
  CodeScanningAlert,
  DependabotAlert,
  SecretScanningAlert,
  SecurityReader,
} from '../github/security-reader.ts';
import {
  ALERT_KINDS,
  type AlertKind,
  type AlertSeverity,
  type AlertSource,
  SEVERITIES,
  type SecurityAlert,
  type SecurityReport,
  type SeverityCounts,
} from './security-types.ts';
import { sourceFailureOf } from './source-failure.ts';

/** Each secret's place costs a request of its own; past this many, a secret shows without one. */
const SECRET_PLACE_LIMIT = 30;

const isSeverity = (value: string): value is AlertSeverity =>
  (SEVERITIES as readonly string[]).includes(value);

/** GitHub's GraphQL and older advisories say `moderate` where REST says `medium`. */
const ADVISORY_ALIASES: Readonly<Record<string, AlertSeverity>> = { moderate: 'medium' };
/** An alert GitHub gives no grade is shown as medium: neither buried nor raised above a known high. */
const UNGRADED: AlertSeverity = 'medium';
/** A rule with no security grade has only its level, which is about the code, not the risk. */
const RULE_LEVELS: Readonly<Record<string, AlertSeverity>> = {
  error: 'high',
  warning: 'medium',
  note: 'low',
  none: 'low',
};

export function advisorySeverity(severity: string): AlertSeverity {
  const word = severity.toLowerCase();
  return isSeverity(word) ? word : (ADVISORY_ALIASES[word] ?? UNGRADED);
}

export function codeScanningSeverity(alert: CodeScanningAlert): AlertSeverity {
  const level = alert.securitySeverity.toLowerCase();
  return isSeverity(level) ? level : (RULE_LEVELS[alert.ruleSeverity.toLowerCase()] ?? UNGRADED);
}

/** A secret that still works, or is out in public, is the worst thing on the list. */
const secretSeverity = (alert: SecretScanningAlert): AlertSeverity =>
  alert.isActive || alert.isPubliclyLeaked ? 'critical' : 'high';

export function dependabotAlert(alert: DependabotAlert): SecurityAlert {
  const pkg = [alert.packageName, alert.ecosystem && `(${alert.ecosystem})`].filter(Boolean);
  const where = [pkg.join(' '), alert.manifest].filter(Boolean).join(' · ');
  return {
    kind: 'dependabot',
    number: alert.number,
    severity: advisorySeverity(alert.severity),
    title: alert.summary || `Vulnerable ${alert.packageName || 'dependency'}`,
    where,
    createdAt: alert.createdAt,
    url: alert.url,
  };
}

export function codeScanningAlert(alert: CodeScanningAlert): SecurityAlert {
  return {
    kind: 'code-scanning',
    number: alert.number,
    severity: codeScanningSeverity(alert),
    title: alert.rule || 'Code-scanning alert',
    where: alert.path && alert.line !== null ? `${alert.path}:${alert.line}` : alert.path,
    createdAt: alert.createdAt,
    url: alert.url,
  };
}

function secretScanningAlert(alert: SecretScanningAlert, where: string): SecurityAlert {
  const notes = [alert.isActive && 'still works', alert.isPubliclyLeaked && 'leaked publicly'];
  const said = notes.filter(Boolean).join(', ');
  return {
    kind: 'secret-scanning',
    number: alert.number,
    severity: secretSeverity(alert),
    title: said ? `${alert.secretType} (${said})` : alert.secretType,
    where,
    createdAt: alert.createdAt,
    url: alert.url,
  };
}

/** Most severe first, then the one open longest. */
function bySeverity(a: SecurityAlert, b: SecurityAlert): number {
  const rank = SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
  return rank || Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

function severityCounts(alerts: readonly SecurityAlert[]): SeverityCounts {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const alert of alerts) counts[alert.severity]++;
  return counts;
}

/** A place that cannot be read leaves the secret without one rather than sinking the list. */
async function placeOf(github: SecurityReader, repo: string, alert: number): Promise<string> {
  try {
    return await github.secretPlace(repo, alert);
  } catch (error: unknown) {
    console.error(`Could not read where ${repo}'s secret alert ${alert} was found:`, error);
    return '';
  }
}

async function secretAlerts(github: SecurityReader, repo: string): Promise<SecurityAlert[]> {
  const alerts = await github.secretScanningAlerts(repo);
  return Promise.all(
    alerts.map(async (alert, index) =>
      secretScanningAlert(
        alert,
        index < SECRET_PLACE_LIMIT ? await placeOf(github, repo, alert.number) : '',
      ),
    ),
  );
}

const READS: Readonly<
  Record<AlertKind, (github: SecurityReader, repo: string) => Promise<SecurityAlert[]>>
> = {
  dependabot: async (github, repo) => (await github.dependabotAlerts(repo)).map(dependabotAlert),
  'code-scanning': async (github, repo) =>
    (await github.codeScanningAlerts(repo)).map(codeScanningAlert),
  'secret-scanning': secretAlerts,
};

interface SourceRead {
  readonly source: AlertSource;
  readonly alerts: readonly SecurityAlert[];
}

const NONE: SeverityCounts = severityCounts([]);

/** One list, or a plain note on why GitHub would not give it: never an error for the page. */
async function readSource(
  github: SecurityReader,
  repo: string,
  kind: AlertKind,
): Promise<SourceRead> {
  try {
    const alerts = await READS[kind](github, repo);
    return { source: { kind, status: 'read', note: null, counts: severityCounts(alerts) }, alerts };
  } catch (error: unknown) {
    const failure = sourceFailureOf(kind, error);
    if (failure.status === 'failed')
      console.error(`Could not read ${repo}'s ${kind} alerts:`, error);
    return { source: { kind, ...failure, counts: NONE }, alerts: [] };
  }
}

/** The Security screen's report: every open alert of the three lists, most severe first. */
export async function securityReport(
  github: SecurityReader,
  repo: string,
  now = Date.now(),
): Promise<SecurityReport> {
  const reads = await Promise.all(ALERT_KINDS.map((kind) => readSource(github, repo, kind)));
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    sources: reads.map((read) => read.source),
    alerts: reads.flatMap((read) => read.alerts).sort(bySeverity),
    isWithheld: false,
  };
}

/** The counts without the alerts, for a preview visitor. */
export const withoutAlerts = (report: SecurityReport): SecurityReport => ({
  ...report,
  alerts: [],
  isWithheld: true,
});
