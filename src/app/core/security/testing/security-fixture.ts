import { SecurityAlert, SecurityReport, SeverityCounts } from '../security-report';

/** 11:00 UTC on 7 October 2026: when the fixture report was made. */
export const SECURITY_NOW = Date.parse('2026-10-07T11:00:00Z');
const DAY = 86_400_000;

export const NO_COUNTS: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

/** A high Dependabot alert opened `daysAgo` before SECURITY_NOW, with any field replaced. */
export function securityAlert(
  number: number,
  daysAgo: number,
  more: Partial<SecurityAlert> = {},
): SecurityAlert {
  return {
    kind: 'dependabot',
    number,
    severity: 'high',
    title: `Advisory ${number}`,
    where: 'lodash (npm) · package-lock.json',
    createdAt: SECURITY_NOW - daysAgo * DAY,
    url: `https://github.com/me/app/security/dependabot/${number}`,
    ...more,
  };
}

/** A report of `alerts`, every list read, with counts to match. */
export function securityReport(alerts: readonly SecurityAlert[]): SecurityReport {
  return {
    generatedAt: SECURITY_NOW,
    repo: 'me/app',
    sources: (['dependabot', 'code-scanning', 'secret-scanning'] as const).map((kind) => {
      const counts = { ...NO_COUNTS };
      for (const alert of alerts) if (alert.kind === kind) counts[alert.severity]++;
      return { kind, status: 'read', note: null, counts };
    }),
    alerts,
    isWithheld: false,
  };
}
