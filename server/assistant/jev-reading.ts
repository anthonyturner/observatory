import { ACTABLE_IDS, type ActableId, isActable } from './actions.ts';
import { LOOK_CHOICE, QUICK_CHOICE, actionChoice, taskChoice } from './choices.ts';
import type { KeywordMatch } from './keyword-match.ts';
import type { JevAnswer, JevAnswers } from './open-router.ts';
import type { Choice, Project } from './route-contract.ts';

/** Below these, Home asks instead of acting. A wrong tier-1 guess is a jump to
 *  the wrong page, so it needs the higher bar; a wrong tier-2 guess costs one
 *  cheap call; a tier-3 guess is only ever a proposal. Starting values, to be
 *  tuned against real requests. */
const ASK_BELOW = { tier: 0.6, action: 0.7, project: 0.7 } as const;

/** How many readings an unsure answer offers as buttons. */
const UNSURE_OPTIONS = 2;

/** What to do with Jev's answers. */
export type JevDecision =
  | { readonly kind: 'act'; readonly action: ActableId; readonly project: Project | null }
  | { readonly kind: 'quick' }
  | { readonly kind: 'look' }
  | { readonly kind: 'propose'; readonly project: Project | null }
  | { readonly kind: 'unsure'; readonly ask: readonly Choice[] };

export interface JevReading {
  /** How sure Jev was of the tier. */
  readonly confidence: number;
  readonly decision: JevDecision;
}

interface Sureness {
  readonly choice: string | null;
  readonly sure: number;
  chanceOf(key: string): number;
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

/** How sure Jev was of one answer: its own confidence when it gives one on a
 *  0–1 scale, else the probability it gave its choice. */
function sureOf(answer: JevAnswer | undefined): Sureness {
  if (!answer) return { choice: null, sure: 0, chanceOf: () => 0 };
  const probabilities = isObject(answer.probabilities) ? answer.probabilities : {};
  const choice = typeof answer.choice === 'string' ? answer.choice : null;
  const own = Number(answer.confidence);
  const sure =
    Number.isFinite(own) && own >= 0 && own <= 1
      ? own
      : Number(choice === null ? undefined : probabilities[choice]) || 0;
  const chanceOf = (key: string): number => {
    const chance = Number(probabilities[key]);
    if (Number.isFinite(chance)) return chance;
    return key === choice ? sure : 0;
  };
  return { choice, sure, chanceOf };
}

/** Unsure: the two best readings, by probability, as buttons. */
function unsureChoices(tier: Sureness, action: Sureness, project: Project | null): Choice[] {
  const topActions = ACTABLE_IDS.map((id) => ({ id, chance: action.chanceOf(id) }))
    .sort((a, b) => b.chance - a.chance)
    .slice(0, UNSURE_OPTIONS);
  return [
    ...topActions.map(({ id, chance }) => ({
      choice: actionChoice(id, project),
      score: tier.chanceOf('tier1') * chance,
    })),
    { choice: QUICK_CHOICE, score: tier.chanceOf('tier2') },
    { choice: LOOK_CHOICE, score: tier.chanceOf('web') },
    { choice: taskChoice(project), score: tier.chanceOf('tier3') },
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, UNSURE_OPTIONS)
    .map(({ choice }) => choice);
}

function decisionOf(tier: Sureness, action: Sureness, project: Project | null): JevDecision {
  const isSureOfTier = tier.sure >= ASK_BELOW.tier;
  if (
    isSureOfTier &&
    tier.choice === 'tier1' &&
    isActable(action.choice) &&
    action.sure >= ASK_BELOW.action
  ) {
    return { kind: 'act', action: action.choice, project };
  }
  if (isSureOfTier && tier.choice === 'tier2') return { kind: 'quick' };
  if (isSureOfTier && tier.choice === 'web') return { kind: 'look' };
  if (isSureOfTier && tier.choice === 'tier3') return { kind: 'propose', project };
  return { kind: 'unsure', ask: unsureChoices(tier, action, project) };
}

/** What Jev's answers mean for one request. A project the keywords named
 *  wins over Jev's reading of one. */
export function readJev(
  answers: JevAnswers,
  match: KeywordMatch,
  projects: readonly Project[],
): JevReading {
  const tier = sureOf(answers['tier']);
  const named = sureOf(answers['project']);
  const project =
    match.project ??
    (named.sure >= ASK_BELOW.project
      ? (projects.find((each) => each.name === named.choice) ?? null)
      : null);
  return { confidence: tier.sure, decision: decisionOf(tier, sureOf(answers['action']), project) };
}
