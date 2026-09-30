/* Nudges from the agent runs: each says in plain words what happened this
   week, and which chart shows it. A nudge appears only when its trigger holds,
   and at most one of each kind is shown. */

import { formatTokens } from '../usage/usage-format';
import { groupOf } from './agent-groups';
import { AgentRun } from './agent-usage-document';
import { weekStart } from './agent-review-week';

export type NudgeKind = 'near-limit' | 'busy-day' | 'pricier' | 'rework' | 'skipped-qa';

/** Where a nudge leads: a chart on Home, narrowed; or a change on its project's star map. */
export type NudgeTarget =
  | {
      readonly kind: 'chart';
      readonly chart: 'context' | 'daily' | 'rank' | 'grid';
      readonly agent?: string;
      readonly project?: string;
      readonly day?: string;
    }
  | { readonly kind: 'issue'; readonly repo: string; readonly issue: number };

export interface Nudge {
  /** Kind and subject, unique among the nudges shown. */
  readonly id: string;
  readonly kind: NudgeKind;
  readonly text: string;
  readonly target: NudgeTarget;
}

/** A run whose fullest request passed this many tokens came near the standard 200k window. */
export const NEAR_LIMIT_TOKENS = 160_000;
export const NEAR_LIMIT_RUNS = 3;
/** Today at this multiple of a usual day's work, or more, is a busy day. */
export const BUSY_PACE = 2;
/** A run this week costing this much more than before, on at least this many runs each side. */
export const PRICIER_RATIO = 1.3;
export const PRICIER_RUNS = 3;
/** A project with this many dev runs this week and no qa run skipped review. */
export const SKIPPED_QA_DEV_RUNS = 2;

const PIPELINE = new Set(['pm', 'refine', 'ux-design', 'dev', 'qa']);
const times = (count: number): string => (count === 1 ? 'once' : `${count} times`);

const ended = (run: AgentRun): number => Date.parse(run.endedAt);

/** Pipeline agents whose runs came near the window three times or more this week. */
export function nearLimitNudges(runs: readonly AgentRun[], now: number): Nudge[] {
  const since = weekStart(now).getTime();
  const counts = new Map<string, number>();
  for (const run of runs) {
    if (ended(run) < since || run.peakContext < NEAR_LIMIT_TOKENS) continue;
    const group = groupOf(run.agent).id;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count >= NEAR_LIMIT_RUNS)
    .sort((a, b) => b[1] - a[1])
    .map(([agent, count]) => ({
      id: `near-limit:${agent}`,
      kind: 'near-limit',
      text: `${agent} ran near or past the 200k context window ${times(count)} this week`,
      target: { kind: 'chart', chart: 'context', agent },
    }));
}

/** Today at twice a usual day's Claude Code work or more, when the pace is known. */
export function busyDayNudges(pace: number | null, today: string): Nudge[] {
  if (pace === null || pace < BUSY_PACE) return [];
  return [
    {
      id: `busy-day:${today}`,
      kind: 'busy-day',
      text: `Busy day: ${pace}× your usual Claude Code work so far`,
      target: { kind: 'chart', chart: 'daily', day: today },
    },
  ];
}

/** Agents whose runs cost a good deal more this week than in the weeks before it. */
export function pricierNudges(runs: readonly AgentRun[], now: number): Nudge[] {
  const since = weekStart(now).getTime();
  const byGroup = new Map<string, { week: number[]; before: number[] }>();
  for (const run of runs) {
    const group = groupOf(run.agent).id;
    const sides = byGroup.get(group) ?? { week: [], before: [] };
    (ended(run) >= since ? sides.week : sides.before).push(run.workTokens);
    byGroup.set(group, sides);
  }
  const average = (values: readonly number[]): number =>
    values.reduce((total, value) => total + value, 0) / values.length;
  return [...byGroup]
    .filter(([, { week, before }]) => week.length >= PRICIER_RUNS && before.length >= PRICIER_RUNS)
    .map(([agent, { week, before }]) => ({ agent, now: average(week), was: average(before) }))
    .filter(({ now: current, was }) => was > 0 && current >= was * PRICIER_RATIO)
    .sort((a, b) => b.now / b.was - a.now / a.was)
    .map(({ agent, now: current, was }) => ({
      id: `pricier:${agent}`,
      kind: 'pricier',
      text: `${agent} is getting pricier: ${formatTokens(current)} a run this week, up from ${formatTokens(was)}`,
      target: { kind: 'chart', chart: 'rank', agent },
    }));
}

/** Changes whose pipeline ran one of its stages again this week: rework. */
export function reworkNudges(runs: readonly AgentRun[], now: number): Nudge[] {
  const since = weekStart(now).getTime();
  const byChange = new Map<string, AgentRun[]>();
  for (const run of runs) {
    if (run.issue === null || run.repo === null) continue;
    const key = `${run.repo}#${run.issue}`;
    byChange.set(key, [...(byChange.get(key) ?? []), run]);
  }
  const nudges: Nudge[] = [];
  for (const [key, mine] of byChange) {
    const seen = new Set<string>();
    const repeat = [...mine]
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .find((run) => {
        const stage = groupOf(run.agent).id;
        const again = PIPELINE.has(stage) && seen.has(stage);
        seen.add(stage);
        return again && ended(run) >= since;
      });
    if (!repeat) continue;
    const stage = groupOf(repeat.agent).id;
    nudges.push({
      id: `rework:${key}`,
      kind: 'rework',
      text: `#${repeat.issue} in ${repeat.project} ran its ${stage} stage again`,
      target: { kind: 'issue', repo: repeat.repo as string, issue: repeat.issue as number },
    });
  }
  return nudges;
}

/** Projects where dev ran this week and qa did not. */
export function skippedQaNudges(runs: readonly AgentRun[], now: number): Nudge[] {
  const since = weekStart(now).getTime();
  const byProject = new Map<string, { dev: number; qa: number }>();
  for (const run of runs) {
    if (ended(run) < since) continue;
    const counts = byProject.get(run.project) ?? { dev: 0, qa: 0 };
    const group = groupOf(run.agent).id;
    if (group === 'dev') counts.dev++;
    if (group === 'qa') counts.qa++;
    byProject.set(run.project, counts);
  }
  return [...byProject]
    .filter(([, { dev, qa }]) => dev >= SKIPPED_QA_DEV_RUNS && qa === 0)
    .sort((a, b) => b[1].dev - a[1].dev)
    .map(([project, { dev }]) => ({
      id: `skipped-qa:${project}`,
      kind: 'skipped-qa',
      text: `${project}: dev ran ${times(dev)} this week, and qa never did`,
      target: { kind: 'chart', chart: 'grid', project },
    }));
}

/** The strongest nudge of each kind not dismissed today: once one of a kind is
 *  dismissed, that kind rests until tomorrow, so another of it cannot take its place. */
export function agentNudges(
  runs: readonly AgentRun[],
  pace: number | null,
  now: number,
  today: string,
  dismissed: ReadonlySet<NudgeKind>,
): Nudge[] {
  const kinds = [
    nearLimitNudges(runs, now),
    busyDayNudges(pace, today),
    pricierNudges(runs, now),
    reworkNudges(runs, now),
    skippedQaNudges(runs, now),
  ];
  return kinds
    .flatMap((nudges) => nudges.slice(0, 1))
    .filter((nudge) => !dismissed.has(nudge.kind));
}
