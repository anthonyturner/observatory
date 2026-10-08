/** A deployment as `GET /api/deployments` sends it, as Vercel posts one. */
export const rawDeployment = (
  id: number,
  environment: string,
  outcome: string,
  more: object = {},
): Record<string, unknown> => ({
  id,
  environment,
  sha: `${id}`.padEnd(40, 'a'),
  ref: null,
  creator: 'vercel[bot]',
  createdAt: '2026-10-08T12:00:00Z',
  outcome,
  description: 'Deployment has completed',
  url: `https://app-${id}.vercel.app`,
  logUrl: `https://app-${id}.vercel.app`,
  commitUrl: `https://github.com/me/app/commit/${`${id}`.padEnd(40, 'a')}`,
  ...more,
});

/** The report as `GET /api/deployments` sends it: production, then a preview with history. */
export const RAW_REPORT = {
  generatedAt: '2026-10-08T13:00:00Z',
  repo: 'me/app',
  environmentCount: 2,
  environments: [
    {
      name: 'Production',
      isProduction: true,
      url: 'https://github.com/me/app/deployments/activity_log?environments_filter=Production',
      deployments: [rawDeployment(5, 'Production', 'ready')],
    },
    {
      name: 'Preview',
      isProduction: false,
      url: 'https://github.com/me/app/deployments/activity_log?environments_filter=Preview',
      deployments: [
        rawDeployment(4, 'Preview', 'building', {
          url: null,
          logUrl: 'https://vercel.com/me/app/4',
        }),
        rawDeployment(3, 'Preview', 'failed', { createdAt: '2026-10-08T10:00:00Z' }),
      ],
    },
  ],
};
