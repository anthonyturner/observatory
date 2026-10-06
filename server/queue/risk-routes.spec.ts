import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { withRiskRoutes } from './risk-routes.ts';
import { NO_SUMMARIES, type RiskSummaries, type SummaryInput } from './risk-summary.ts';

const HEAD = 'c'.repeat(40);

const detail = (number: number): SummaryInput => ({
  number,
  title: 'Sign in with GitHub',
  body: '',
  headOid: HEAD,
  changedFiles: 1,
  additions: 40,
  deletions: 2,
  files: [{ path: 'server/hosted/github-sign-in.ts', additions: 40, deletions: 2 }],
});

const read = async (_repo: string, number: number) => detail(number);

const summaries: RiskSummaries = {
  isOn: true,
  summaryOf: async (repo, pull) => `Summary of ${repo}#${pull.number}`,
};

const get = async (summarizer: RiskSummaries, path: string): Promise<unknown> => {
  const handler = createApiHandler(withRiskRoutes({ get: {}, post: {} }, read, summarizer));
  const response = await handler(new Request(`http://localhost${path}`));
  assert.equal(response.status, 200);
  return response.json();
};

describe('withRiskRoutes', () => {
  it('rates a pull request at its head commit, and says a summary can be asked for', async () => {
    assert.deepEqual(await get(summaries, '/api/risk?repo=me/app&number=7'), {
      number: 7,
      headSha: HEAD,
      level: 'high',
      reasons: ['auth'],
      summarizes: true,
    });
  });

  it('says what the change does where a model is set', async () => {
    assert.deepEqual(await get(summaries, '/api/risk/summary?repo=me/app&number=7'), {
      number: 7,
      headSha: HEAD,
      summary: 'Summary of me/app#7',
    });
  });

  it('gives the rules alone with no model', async () => {
    const glance = (await get(NO_SUMMARIES, '/api/risk?repo=me/app&number=7')) as {
      summarizes: boolean;
    };
    assert.equal(glance.summarizes, false);
    assert.deepEqual(await get(NO_SUMMARIES, '/api/risk/summary?repo=me/app&number=7'), {
      number: 7,
      headSha: HEAD,
      summary: null,
    });
  });

  it('refuses a request without a repository or a number', async () => {
    const handler = createApiHandler(withRiskRoutes({ get: {}, post: {} }, read, summaries));
    const response = await handler(new Request('http://localhost/api/risk?repo=me/app'));
    assert.equal(response.status, 400);
  });
});
