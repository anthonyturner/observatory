import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  CodeScanningAlert,
  DependabotAlert,
  SecretScanningAlert,
  SecurityReader,
} from '../github/security-reader.ts';
import {
  advisorySeverity,
  codeScanningAlert,
  codeScanningSeverity,
  dependabotAlert,
  securityReport,
  withoutAlerts,
} from './security-report.ts';
import { sourceFailureOf } from './source-failure.ts';

const NOW = Date.parse('2026-10-07T11:00:00Z');

const dependabot = (number: number, severity: string, createdAt: string): DependabotAlert => ({
  number,
  severity,
  summary: `Advisory ${number}`,
  ecosystem: 'npm',
  packageName: 'lodash',
  manifest: 'package-lock.json',
  createdAt,
  url: `https://github.com/me/app/security/dependabot/${number}`,
});

const code = (more: Partial<CodeScanningAlert> = {}): CodeScanningAlert => ({
  number: 3,
  securitySeverity: '',
  ruleSeverity: 'warning',
  rule: 'Unused variable',
  path: 'src/a.ts',
  line: 9,
  createdAt: '2026-10-02T10:00:00Z',
  url: 'https://github.com/me/app/security/code-scanning/3',
  ...more,
});

const secret = (more: Partial<SecretScanningAlert> = {}): SecretScanningAlert => ({
  number: 1,
  secretType: 'Slack Token',
  isActive: false,
  isPubliclyLeaked: false,
  createdAt: '2026-10-05T10:00:00Z',
  url: 'https://github.com/me/app/security/secret-scanning/1',
  ...more,
});

const denied = (message: string) => async (): Promise<never> => {
  throw new Error(message);
};

function reader(more: Partial<SecurityReader> = {}): SecurityReader {
  return {
    dependabotAlerts: async () => [
      dependabot(7, 'medium', '2026-09-01T10:00:00Z'),
      dependabot(8, 'critical', '2026-10-06T10:00:00Z'),
    ],
    codeScanningAlerts: async () => [code()],
    secretScanningAlerts: async () => [secret({ isActive: true })],
    secretPlace: async () => '.env:3',
    ...more,
  };
}

describe('the severity of an alert', () => {
  it('takes an advisory’s grade, reading moderate as medium and none as medium', () => {
    assert.equal(advisorySeverity('CRITICAL'), 'critical');
    assert.equal(advisorySeverity('moderate'), 'medium');
    assert.equal(advisorySeverity(''), 'medium');
  });

  it('takes a code rule’s security grade, else its level', () => {
    assert.equal(codeScanningSeverity(code({ securitySeverity: 'critical' })), 'critical');
    assert.equal(codeScanningSeverity(code({ ruleSeverity: 'error' })), 'high');
    assert.equal(codeScanningSeverity(code({ ruleSeverity: 'note' })), 'low');
  });
});

describe('an alert as the screen shows it', () => {
  it('names a dependency’s package and manifest, and a code alert’s file and line', () => {
    assert.equal(
      dependabotAlert(dependabot(7, 'low', NOW.toString())).where,
      'lodash (npm) · package-lock.json',
    );
    assert.equal(codeScanningAlert(code()).where, 'src/a.ts:9');
    assert.equal(codeScanningAlert(code({ line: null })).where, 'src/a.ts');
  });
});

describe('securityReport', () => {
  it('lists every alert of the three, most severe first, then the longest open', async () => {
    const report = await securityReport(reader(), 'me/app', NOW);

    assert.deepEqual(
      report.alerts.map((alert) => [alert.kind, alert.number, alert.severity]),
      [
        ['secret-scanning', 1, 'critical'],
        ['dependabot', 8, 'critical'],
        ['dependabot', 7, 'medium'],
        ['code-scanning', 3, 'medium'],
      ],
    );
    assert.equal(report.alerts[0].title, 'Slack Token (still works)');
    assert.equal(report.alerts[0].where, '.env:3');
    assert.deepEqual(report.sources[0], {
      kind: 'dependabot',
      status: 'read',
      note: null,
      counts: { critical: 1, high: 0, medium: 1, low: 0 },
    });
    assert.equal(report.isWithheld, false);
  });

  it('notes a list switched off, or one the token may not read, and still shows the rest', async () => {
    const report = await securityReport(
      reader({
        dependabotAlerts: denied(
          'Command failed: gh api\ngh: Dependabot alerts are disabled for this repository. (HTTP 403)',
        ),
        codeScanningAlerts: denied(
          'GitHub: HTTP 403 Resource not accessible by personal access token',
        ),
      }),
      'me/app',
      NOW,
    );

    assert.deepEqual(
      report.sources.map((source) => [source.kind, source.status]),
      [
        ['dependabot', 'off'],
        ['code-scanning', 'no-access'],
        ['secret-scanning', 'read'],
      ],
    );
    assert.match(report.sources[1].note ?? '', /security_events/);
    assert.equal(report.alerts.length, 1);
  });

  it('keeps a secret whose place cannot be read, without one', async () => {
    const report = await securityReport(
      reader({ secretPlace: denied('GitHub: HTTP 500') }),
      'me/app',
      NOW,
    );

    assert.equal(report.alerts.find((alert) => alert.kind === 'secret-scanning')?.where, '');
  });
});

describe('sourceFailureOf', () => {
  it('reads GitHub’s words for a feature not set up as off, and anything else as a failure', () => {
    assert.equal(
      sourceFailureOf('code-scanning', new Error('no analysis found (HTTP 404)')).status,
      'off',
    );
    assert.equal(
      sourceFailureOf('secret-scanning', new Error('GitHub: HTTP 404 Not Found')).status,
      'no-access',
    );
    assert.equal(sourceFailureOf('dependabot', new Error('socket hang up')).status, 'failed');
  });
});

describe('withoutAlerts', () => {
  it('keeps the counts and drops every alert', async () => {
    const report = withoutAlerts(await securityReport(reader(), 'me/app', NOW));

    assert.deepEqual(report.alerts, []);
    assert.equal(report.isWithheld, true);
    assert.equal(report.sources[0].counts.critical, 1);
  });
});
