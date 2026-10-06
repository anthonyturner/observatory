import { isCount, isObject, isString, strings } from './pull-detail-parts';

export type RiskLevel = 'low' | 'medium' | 'high';

/** What `GET /api/risk` returns: a pull request's risk at its head commit, from its files. */
export interface RiskGlance {
  readonly number: number;
  readonly headSha: string;
  readonly level: RiskLevel;
  /** What raised it: `auth`, `migrations`, `config`, `CI`, `dependencies`, `broad`. */
  readonly reasons: readonly string[];
  /** Whether `GET /api/risk/summary` can say what the change does. */
  readonly summarizes: boolean;
}

/** What `GET /api/risk/summary` returns. */
export interface RiskSummary {
  readonly headSha: string;
  /** Null with no AI key on the server, or when the model failed. */
  readonly summary: string | null;
}

/** What the star card shows: the tag, what raised it, and the one-line summary. */
export interface RiskView {
  readonly level: RiskLevel;
  /** "High risk". */
  readonly label: string;
  /** "auth · migrations", or empty. */
  readonly reasons: string;
  readonly summary: string | null;
}

const LEVELS: ReadonlySet<string> = new Set<RiskLevel>(['low', 'medium', 'high']);
const isLevel = (value: unknown): value is RiskLevel => isString(value) && LEVELS.has(value);

/** Reads the answer defensively; one without a level or head is no answer. */
export function parseRiskGlance(value: unknown): RiskGlance | null {
  if (!isObject(value)) return null;
  const { number, headSha, level } = value;
  if (!isCount(number) || !isString(headSha) || !isLevel(level)) return null;
  return {
    number,
    headSha,
    level,
    reasons: strings(value['reasons']),
    summarizes: value['summarizes'] === true,
  };
}

export function parseRiskSummary(value: unknown): RiskSummary | null {
  if (!isObject(value) || !isString(value['headSha'])) return null;
  const summary = value['summary'];
  return { headSha: value['headSha'], summary: isString(summary) && summary ? summary : null };
}

const REASON_SEPARATOR = ' · ';

export function riskViewOf(glance: RiskGlance, summary: string | null): RiskView {
  const { level } = glance;
  return {
    level,
    label: `${level[0].toUpperCase()}${level.slice(1)} risk`,
    reasons: glance.reasons.join(REASON_SEPARATOR),
    summary,
  };
}
