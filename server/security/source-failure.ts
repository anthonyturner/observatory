import type { AlertKind, SourceStatus } from './security-types.ts';

/** Why a list could not be read, in words for the screen. */
export interface SourceFailure {
  readonly status: Exclude<SourceStatus, 'read'>;
  readonly note: string;
}

/**
 * GitHub's own words when a feature is switched off or never set up: "Dependabot
 * alerts are disabled", "...not available for archived repositories", "Code
 * scanning is not enabled", "no analysis found", "Secret scanning is disabled".
 */
const FEATURE_OFF = /disabled|not enabled|not available|no analysis found/i;
/** Both `gh api` and the REST client put GitHub's status in the error. */
const DENIED = /HTTP (?:401|403|404)\b/;

const OFF_NOTES: Readonly<Record<AlertKind, string>> = {
  dependabot: 'Dependabot alerts are off for this repository.',
  'code-scanning': 'Code scanning is not set up for this repository.',
  'secret-scanning': 'Secret scanning is off for this repository.',
};

/** A classic token's scopes, or the fine-grained permission, each list needs (GitHub's REST docs). */
const NO_ACCESS_NOTES: Readonly<Record<AlertKind, string>> = {
  dependabot:
    'The token cannot read Dependabot alerts: it needs the security_events scope, or “Dependabot alerts: read”.',
  'code-scanning':
    'The token cannot read code-scanning alerts: it needs the security_events scope, or “Code scanning alerts: read”.',
  'secret-scanning':
    'The token cannot read secret-scanning alerts: it needs admin access and the repo or security_events scope.',
};

const FAILED_NOTES: Readonly<Record<AlertKind, string>> = {
  dependabot: 'GitHub did not answer for Dependabot alerts. Try again in a moment.',
  'code-scanning': 'GitHub did not answer for code-scanning alerts. Try again in a moment.',
  'secret-scanning': 'GitHub did not answer for secret-scanning alerts. Try again in a moment.',
};

/** The plain note for a list GitHub would not give. */
export function sourceFailureOf(kind: AlertKind, error: unknown): SourceFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (FEATURE_OFF.test(message)) return { status: 'off', note: OFF_NOTES[kind] };
  if (DENIED.test(message)) return { status: 'no-access', note: NO_ACCESS_NOTES[kind] };
  return { status: 'failed', note: FAILED_NOTES[kind] };
}
