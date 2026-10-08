import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  codeScanningAlertsOf,
  dependabotAlertsOf,
  readDependabotAlerts,
  readSecretPlace,
  secretPlaceOf,
  secretScanningAlertsOf,
} from './security-reader.ts';

const basics = (number: number) => ({
  number,
  state: 'open',
  created_at: '2026-10-01T10:00:00Z',
  html_url: `https://github.com/me/app/security/x/${number}`,
});

describe('dependabotAlertsOf', () => {
  it('reads the advisory, the package and its manifest, and leaves out an alert with no number', () => {
    const alerts = dependabotAlertsOf([
      {
        ...basics(4),
        dependency: {
          package: { ecosystem: 'npm', name: 'lodash' },
          manifest_path: 'package-lock.json',
        },
        security_advisory: { summary: 'Prototype pollution', severity: 'high', ghsa_id: 'GHSA-1' },
        security_vulnerability: { severity: 'high' },
      },
      { ...basics(5), number: 'x' },
    ]);

    assert.deepEqual(alerts, [
      {
        number: 4,
        severity: 'high',
        summary: 'Prototype pollution',
        ecosystem: 'npm',
        packageName: 'lodash',
        manifest: 'package-lock.json',
        createdAt: '2026-10-01T10:00:00Z',
        url: 'https://github.com/me/app/security/x/4',
      },
    ]);
  });

  it('reads anything but a list as none', () => {
    assert.deepEqual(dependabotAlertsOf({ message: 'Not Found' }), []);
  });
});

describe('codeScanningAlertsOf', () => {
  it('reads the rule, its grades and the file and line of its latest finding', () => {
    const [alert] = codeScanningAlertsOf([
      {
        ...basics(2),
        rule: {
          id: 'js/xss',
          description: 'Cross-site scripting',
          severity: 'error',
          security_severity_level: 'high',
        },
        most_recent_instance: { location: { path: 'src/page.ts', start_line: 12 } },
      },
    ]);

    assert.equal(alert.rule, 'Cross-site scripting');
    assert.equal(alert.securitySeverity, 'high');
    assert.equal(alert.ruleSeverity, 'error');
    assert.equal(alert.path, 'src/page.ts');
    assert.equal(alert.line, 12);
  });
});

describe('secretScanningAlertsOf', () => {
  it('reads what kind of secret it is and never the secret itself', () => {
    const [alert] = secretScanningAlertsOf([
      {
        ...basics(1),
        secret_type: 'github_personal_access_token',
        secret_type_display_name: 'GitHub Personal Access Token',
        secret: 'the-secret-value',
        validity: 'active',
        publicly_leaked: false,
      },
    ]);

    assert.deepEqual(alert, {
      number: 1,
      secretType: 'GitHub Personal Access Token',
      isActive: true,
      isPubliclyLeaked: false,
      createdAt: '2026-10-01T10:00:00Z',
      url: 'https://github.com/me/app/security/x/1',
    });
    assert.ok(!JSON.stringify(alert).includes('the-secret-value'));
  });
});

describe('secretPlaceOf', () => {
  it('gives a commit’s file and line, another place in words, and nothing for none', () => {
    const commit = [{ type: 'commit', details: { path: '.env', start_line: 3 } }];
    assert.equal(secretPlaceOf(commit), '.env:3');
    assert.equal(secretPlaceOf([{ type: 'issue_comment', details: {} }]), 'issue comment');
    assert.equal(secretPlaceOf([]), '');
  });
});

describe('the alert reads', () => {
  it('ask for the open alerts, a page of them, and one place for a secret', async () => {
    const asked: string[] = [];
    const get = async (path: string) => {
      asked.push(path);
      return [];
    };

    await readDependabotAlerts(get, 'me/app');
    await readSecretPlace(get, 'me/app', 7);

    assert.deepEqual(asked, [
      'repos/me/app/dependabot/alerts?state=open&per_page=100',
      'repos/me/app/secret-scanning/alerts/7/locations?per_page=1',
    ]);
  });
});
