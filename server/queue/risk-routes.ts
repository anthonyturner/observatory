import type { RouteTable } from '../http/api-handler.ts';
import { pullNumberFrom } from './pull-detail.ts';
import { repoNameFrom } from './repo-name.ts';
import { type RiskLevel, type RiskReason, riskOf } from './risk-rules.ts';
import type { RiskSummaries, SummaryInput } from './risk-summary.ts';

/** What `GET /api/risk` returns: a pull request's risk at its head commit. */
export interface RiskGlance {
  readonly number: number;
  readonly headSha: string;
  readonly level: RiskLevel;
  readonly reasons: readonly RiskReason[];
  /** Whether `GET /api/risk/summary` can say what the change does. */
  readonly summarizes: boolean;
}

/** What `GET /api/risk/summary` returns. */
export interface RiskSummary {
  readonly number: number;
  readonly headSha: string;
  /** Null with no AI key, or when the model failed. */
  readonly summary: string | null;
}

export const RISK_PATH = '/api/risk';
export const RISK_SUMMARY_PATH = '/api/risk/summary';

/** One pull request's details, read through the API's cache. */
export type PullRead = (repo: string, number: number) => Promise<SummaryInput>;

export const riskGlanceOf = (pull: SummaryInput, summarizes: boolean): RiskGlance => ({
  number: pull.number,
  headSha: pull.headOid,
  ...riskOf(pull),
  summarizes,
});

/** `table` with the risk glance: the rules always, the summary where a model is set. */
export function withRiskRoutes(
  table: RouteTable,
  pull: PullRead,
  summaries: RiskSummaries,
): RouteTable {
  const pullOf = (query: URLSearchParams): Promise<SummaryInput> =>
    pull(repoNameFrom(query.get('repo')), pullNumberFrom(query.get('number')));
  return {
    ...table,
    get: {
      ...table.get,
      [RISK_PATH]: async (query) => riskGlanceOf(await pullOf(query), summaries.isOn),
      [RISK_SUMMARY_PATH]: async (query): Promise<RiskSummary> => {
        const detail = await pullOf(query);
        const summary = await summaries.summaryOf(repoNameFrom(query.get('repo')), detail);
        return { number: detail.number, headSha: detail.headOid, summary };
      },
    },
  };
}
