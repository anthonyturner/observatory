import { parseDeploymentsReport } from '../../core/deployments/deployments-report';
import { RAW_REPORT, rawDeployment } from '../../core/deployments/testing/deployments-fixture';
import { environmentSections } from './deploy-list/deploy-rows';
import { commitWords, deploymentsStamp, emptyMessage, stateMessage } from './deploy-words';

const report = parseDeploymentsReport(RAW_REPORT)!;

describe('Deployments words', () => {
  it('names a commit, and the branch when it was deployed by one', () => {
    const [preview] = report.environments[1].deployments;
    const byBranch = parseDeploymentsReport({
      ...RAW_REPORT,
      environments: [
        {
          ...RAW_REPORT.environments[0],
          deployments: [rawDeployment(9, 'Production', 'ready', { ref: 'main' })],
        },
      ],
    })!;

    expect(commitWords(preview)).toBe('4aaaaaa');
    expect(commitWords(byBranch.environments[0].deployments[0])).toBe('9aaaaaa on main');
  });

  it('says what the header and an empty or unread page say', () => {
    expect(deploymentsStamp('me/app', report)).toBe('me/app · 2 environments');
    expect(deploymentsStamp('me/app', null)).toBe('me/app');
    expect(deploymentsStamp('me/app', { ...report, environmentCount: 14 })).toBe(
      'me/app · 2 of 14 environments',
    );
    expect(emptyMessage(report)).toBeNull();
    expect(emptyMessage({ ...report, environments: [] })?.headline).toBe('No deployments yet');
    expect(stateMessage({ status: 'missing' })?.headline).toBe('No such project');
    expect(stateMessage({ status: 'ready', report })).toBeNull();
  });
});

describe('environmentSections', () => {
  it('lists each environment newest first, a log only when it is not the site', () => {
    const [production, preview] = environmentSections(report.environments, report.generatedAt);

    expect(production.rows.map((row) => [row.outcome, row.siteUrl, row.logUrl])).toEqual([
      ['Ready', 'https://app-5.vercel.app', null],
    ]);
    expect(preview.rows.map((row) => [row.outcome, row.when, row.logUrl])).toEqual([
      ['Building', '1h ago', 'https://vercel.com/me/app/4'],
      ['Failed', '3h ago', null],
    ]);
  });
});
