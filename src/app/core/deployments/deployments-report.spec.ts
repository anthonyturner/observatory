import {
  isBuilding,
  isReportBuilding,
  parseDeployment,
  parseDeploymentsReport,
  parsePullPreview,
  shortSha,
} from './deployments-report';
import { RAW_REPORT, rawDeployment } from './testing/deployments-fixture';

describe('parseDeploymentsReport', () => {
  it('reads each environment and its deployments, times as milliseconds', () => {
    const report = parseDeploymentsReport(RAW_REPORT);

    expect(report?.generatedAt).toBe(Date.parse('2026-10-08T13:00:00Z'));
    expect(report?.environments.map((each) => [each.name, each.isProduction])).toEqual([
      ['Production', true],
      ['Preview', false],
    ]);
    const [building, failed] = report?.environments[1].deployments ?? [];
    expect(building.outcome).toBe('building');
    expect(building.url).toBeNull();
    expect(building.logUrl).toBe('https://vercel.com/me/app/4');
    expect(failed.createdAt).toBe(Date.parse('2026-10-08T10:00:00Z'));
    expect(report && isReportBuilding(report)).toBe(false);
    const soonAfter = Date.parse('2026-10-08T12:10:00Z');
    expect(report && isReportBuilding({ ...report, generatedAt: soonAfter })).toBe(true);
  });

  it('counts no fewer environments than it was given', () => {
    const { environmentCount, ...without } = RAW_REPORT;

    expect(environmentCount).toBe(2);
    expect(parseDeploymentsReport(without)?.environmentCount).toBe(2);
    expect(parseDeploymentsReport({ ...RAW_REPORT, environmentCount: 9 })?.environmentCount).toBe(
      9,
    );
  });

  it('reads an answer that is not a report as none', () => {
    expect(parseDeploymentsReport({ repo: 'me/app' })).toBeNull();
    expect(parseDeploymentsReport('down')).toBeNull();
  });

  it('drops an environment whose link is not GitHub’s', () => {
    const report = parseDeploymentsReport({
      ...RAW_REPORT,
      environments: [{ ...RAW_REPORT.environments[0], url: 'https://evil.example' }],
    });

    expect(report?.environments).toEqual([]);
  });
});

describe('parseDeployment', () => {
  it('keeps only web links to the site and the log, and a commit link on GitHub', () => {
    const deployment = parseDeployment(
      rawDeployment(1, 'Preview', 'ready', {
        url: 'javascript:alert(1)',
        logUrl: 'http://localhost:3000/log',
      }),
    );

    expect(deployment?.url).toBeNull();
    expect(deployment?.logUrl).toBe('http://localhost:3000/log');
    expect(
      parseDeployment(rawDeployment(1, 'Preview', 'ready', { commitUrl: 'https://x.dev' })),
    ).toBeNull();
  });

  it('leaves out a deployment with an outcome it does not know', () => {
    expect(parseDeployment(rawDeployment(1, 'Preview', 'exploded'))).toBeNull();
  });
});

describe('parsePullPreview', () => {
  it('reads a commit’s deployments, and says when one is still building', () => {
    const preview = parsePullPreview({
      repo: 'me/app',
      sha: 'a'.repeat(40),
      deployments: [rawDeployment(1, 'Preview', 'building')],
    });

    expect(preview?.deployments.map((each) => each.environment)).toEqual(['Preview']);
    expect(isBuilding(preview?.deployments ?? [])).toBe(true);
    expect(parsePullPreview({ deployments: [] })).toBeNull();
  });

  it('shortens a commit as GitHub does', () => {
    expect(shortSha('92b4594762e64610d3def555ca67aff9f35dac08')).toBe('92b4594');
  });
});
