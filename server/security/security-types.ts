/** Which of GitHub's three alert lists an alert came from. */
export type AlertKind = 'dependabot' | 'code-scanning' | 'secret-scanning';

export const ALERT_KINDS: readonly AlertKind[] = ['dependabot', 'code-scanning', 'secret-scanning'];

/** Most severe first. */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITIES: readonly AlertSeverity[] = ['critical', 'high', 'medium', 'low'];

export type SeverityCounts = Readonly<Record<AlertSeverity, number>>;

/**
 * How reading one list went: `read`, or a plain reason it could not be:
 * the feature is `off` for the repository, the token has `no-access`, or
 * GitHub `failed` to answer.
 */
export type SourceStatus = 'read' | 'off' | 'no-access' | 'failed';

export interface AlertSource {
  readonly kind: AlertKind;
  readonly status: SourceStatus;
  /** One plain line on why nothing was read; null when it was. */
  readonly note: string | null;
  readonly counts: SeverityCounts;
}

export interface SecurityAlert {
  readonly kind: AlertKind;
  readonly number: number;
  readonly severity: AlertSeverity;
  /** The advisory's summary, the broken rule, or the kind of secret: never the secret. */
  readonly title: string;
  /** The package and its manifest, or the file and line; empty when GitHub gives none. */
  readonly where: string;
  readonly createdAt: string;
  readonly url: string;
}

/** What `GET /api/security` returns. */
export interface SecurityReport {
  readonly generatedAt: string;
  readonly repo: string;
  /** One per kind, in ALERT_KINDS order. */
  readonly sources: readonly AlertSource[];
  /** Most severe first, then the longest open. Empty when withheld. */
  readonly alerts: readonly SecurityAlert[];
  /** A preview visitor gets the counts only. */
  readonly isWithheld: boolean;
}
