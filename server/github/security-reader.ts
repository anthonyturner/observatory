import { type Json, type JsonGet, isJson, isText, jsonList } from './rest-json.ts';

/** One open Dependabot alert: a dependency with a known vulnerability. */
export interface DependabotAlert {
  readonly number: number;
  /** GitHub's word: `critical`, `high`, `medium` or `low`; empty when it gives none. */
  readonly severity: string;
  /** The advisory's one-line summary. */
  readonly summary: string;
  readonly ecosystem: string;
  readonly packageName: string;
  /** The lockfile or manifest that pulls the package in. */
  readonly manifest: string;
  readonly createdAt: string;
  readonly url: string;
}

/** One open code-scanning alert: a rule a tool such as CodeQL found broken in the code. */
export interface CodeScanningAlert {
  readonly number: number;
  /** `critical`, `high`, `medium` or `low`, for a security rule; empty for any other. */
  readonly securitySeverity: string;
  /** The rule's own level: `error`, `warning`, `note` or `none`. */
  readonly ruleSeverity: string;
  readonly rule: string;
  readonly path: string;
  readonly line: number | null;
  readonly createdAt: string;
  readonly url: string;
}

/**
 * One open secret-scanning alert. The secret itself is never read off
 * GitHub's answer, so no code past the parser can pass it on.
 */
export interface SecretScanningAlert {
  readonly number: number;
  /** "GitHub Personal Access Token": what kind of secret, never the secret. */
  readonly secretType: string;
  /** GitHub checked with the issuer and the secret still works. */
  readonly isActive: boolean;
  readonly isPubliclyLeaked: boolean;
  readonly createdAt: string;
  readonly url: string;
}

/** What the Security screen reads of a repository's alerts, and nothing else. */
export interface SecurityReader {
  /** Open alerts, up to ALERT_LIMIT. Rejects when the feature is off or the token may not read it. */
  dependabotAlerts(repo: string): Promise<DependabotAlert[]>;
  codeScanningAlerts(repo: string): Promise<CodeScanningAlert[]>;
  secretScanningAlerts(repo: string): Promise<SecretScanningAlert[]>;
  /** Where a secret was first found, as `path:line` or the kind of place; empty when unknown. */
  secretPlace(repo: string, alert: number): Promise<string>;
}

/** One request's worth: GitHub lists at most a hundred a page. */
export const ALERT_LIMIT = 100;

const isId = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;
const textOr = (value: unknown, otherwise: string): string => (isText(value) ? value : otherwise);
const objectOf = (value: unknown): Json => (isJson(value) ? value : {});

interface AlertBasics {
  readonly number: number;
  readonly createdAt: string;
  readonly url: string;
}

function basicsOf(alert: Json): AlertBasics | null {
  const { number, created_at: createdAt, html_url: url } = alert;
  return isId(number) && isText(createdAt) && isText(url) ? { number, createdAt, url } : null;
}

function dependabotAlertOf(alert: Json): DependabotAlert | null {
  const basics = basicsOf(alert);
  if (!basics) return null;
  const advisory = objectOf(alert['security_advisory']);
  const vulnerability = objectOf(alert['security_vulnerability']);
  const dependency = objectOf(alert['dependency']);
  const pkg = objectOf(dependency['package']);
  return {
    ...basics,
    severity: textOr(advisory['severity'], textOr(vulnerability['severity'], '')),
    summary: textOr(advisory['summary'], textOr(advisory['ghsa_id'], '')),
    ecosystem: textOr(pkg['ecosystem'], ''),
    packageName: textOr(pkg['name'], ''),
    manifest: textOr(dependency['manifest_path'], ''),
  };
}

function codeScanningAlertOf(alert: Json): CodeScanningAlert | null {
  const basics = basicsOf(alert);
  if (!basics) return null;
  const rule = objectOf(alert['rule']);
  const instance = objectOf(alert['most_recent_instance']);
  const location = objectOf(instance['location']);
  const line = location['start_line'];
  return {
    ...basics,
    securitySeverity: textOr(rule['security_severity_level'], ''),
    ruleSeverity: textOr(rule['severity'], ''),
    rule: textOr(rule['description'], textOr(rule['name'], textOr(rule['id'], ''))),
    path: textOr(location['path'], ''),
    line: isId(line) ? line : null,
  };
}

function secretScanningAlertOf(alert: Json): SecretScanningAlert | null {
  const basics = basicsOf(alert);
  if (!basics) return null;
  return {
    ...basics,
    secretType: textOr(alert['secret_type_display_name'], textOr(alert['secret_type'], 'Secret')),
    isActive: alert['validity'] === 'active',
    isPubliclyLeaked: alert['publicly_leaked'] === true,
  };
}

const parsed = <T>(body: unknown, parse: (alert: Json) => T | null): T[] =>
  jsonList(body)
    .map(parse)
    .filter((alert) => alert !== null);

/** The alerts in a `GET /dependabot/alerts` answer. */
export const dependabotAlertsOf = (body: unknown): DependabotAlert[] =>
  parsed(body, dependabotAlertOf);

/** The alerts in a `GET /code-scanning/alerts` answer. */
export const codeScanningAlertsOf = (body: unknown): CodeScanningAlert[] =>
  parsed(body, codeScanningAlertOf);

/** The alerts in a `GET /secret-scanning/alerts` answer, without the secrets. */
export const secretScanningAlertsOf = (body: unknown): SecretScanningAlert[] =>
  parsed(body, secretScanningAlertOf);

/** `src/config.ts:12` for a commit, else the place in words, such as "issue comment". */
export function secretPlaceOf(body: unknown): string {
  const [location] = jsonList(body);
  if (!location) return '';
  const details = objectOf(location['details']);
  if (isText(details['path'])) {
    const line = details['start_line'];
    return isId(line) ? `${details['path']}:${line}` : details['path'];
  }
  return textOr(location['type'], '').replaceAll('_', ' ');
}

const openAlerts = (repo: string, kind: string): string =>
  `repos/${repo}/${kind}/alerts?state=open&per_page=${ALERT_LIMIT}`;

export async function readDependabotAlerts(get: JsonGet, repo: string): Promise<DependabotAlert[]> {
  return dependabotAlertsOf(await get(openAlerts(repo, 'dependabot')));
}

export async function readCodeScanningAlerts(
  get: JsonGet,
  repo: string,
): Promise<CodeScanningAlert[]> {
  return codeScanningAlertsOf(await get(openAlerts(repo, 'code-scanning')));
}

export async function readSecretScanningAlerts(
  get: JsonGet,
  repo: string,
): Promise<SecretScanningAlert[]> {
  return secretScanningAlertsOf(await get(openAlerts(repo, 'secret-scanning')));
}

export async function readSecretPlace(get: JsonGet, repo: string, alert: number): Promise<string> {
  return secretPlaceOf(
    await get(`repos/${repo}/secret-scanning/alerts/${alert}/locations?per_page=1`),
  );
}

/** The reader over one way of reading GitHub's REST API. */
export const securityReader = (get: JsonGet): SecurityReader => ({
  dependabotAlerts: (repo) => readDependabotAlerts(get, repo),
  codeScanningAlerts: (repo) => readCodeScanningAlerts(get, repo),
  secretScanningAlerts: (repo) => readSecretScanningAlerts(get, repo),
  secretPlace: (repo, alert) => readSecretPlace(get, repo, alert),
});
