import { ReplyTier } from '../voice/reply-voice';
import { RouteReply } from './assistant.types';

/** The chip's colour: the tier's, a task's warm, waiting, or failed. */
export type ChipTone = 'tier' | 'task' | 'wait' | 'bad';

/** The line over a reply saying which tier it took and how it got there. */
export interface ReplyChip {
  /** ●○○ to ●●●, or null for a chip with no tier to show. */
  readonly pips: string | null;
  readonly text: string;
  readonly tone: ChipTone;
}

const TIER_CHIP: Readonly<Record<ReplyTier, { readonly pips: string; readonly kind: string }>> = {
  1: { pips: '●○○', kind: 'Action' },
  2: { pips: '●●○', kind: 'Answer' },
  3: { pips: '●●●', kind: 'Proposal' },
};
const NO_TIER_PIPS = '○○○';
const MS_PER_SECOND = 1000;

export const WAITING_CHIP: ReplyChip = { pips: null, text: 'Working it out…', tone: 'wait' };
export const NO_ANSWER_CHIP: ReplyChip = { pips: null, text: 'No answer', tone: 'bad' };
/** The chip on a proposal's own card. */
export const TASK_CHIP: ReplyChip = {
  pips: TIER_CHIP[3].pips,
  text: 'Tier 3 · Proposal',
  tone: 'task',
};

const tookText = (ms: number): string =>
  ms < MS_PER_SECOND ? `${ms} ms` : `${(ms / MS_PER_SECOND).toFixed(1)} s`;

/** How the reply was reached. */
function howOf(reply: RouteReply): string {
  if (reply.via === 'agent') return 'Jev';
  if (reply.via === 'pick') return 'your pick';
  return reply.via === 'skill' ? 'skill' : 'keyword';
}

function tierWords(reply: RouteReply, tier: ReplyTier, took: string): string[] {
  const how = howOf(reply);
  return [`Tier ${tier}`, TIER_CHIP[tier].kind, reply.by ? `${how} → ${reply.by}` : how, took];
}

/** A reply with no tier: asking which project for an action, a note, or options. */
function untieredChip(reply: RouteReply, took: string): ReplyChip {
  if (reply.action) {
    const words = ['Tier 1', 'Which project', howOf(reply), took];
    return { pips: TIER_CHIP[1].pips, text: words.join(' · '), tone: 'tier' };
  }
  const words = reply.note
    ? [reply.via === 'skill' ? 'Skill' : 'Keywords only', took]
    : ['Options', howOf(reply), took];
  return { pips: NO_TIER_PIPS, text: words.join(' · '), tone: 'tier' };
}

/** The chip for `reply`, which took `ms` to come back. */
export function chipOf(reply: RouteReply, ms: number): ReplyChip {
  const took = tookText(ms);
  if (!reply.tier) return untieredChip(reply, took);
  const tone: ChipTone = reply.tier === 3 ? 'task' : 'tier';
  return {
    pips: TIER_CHIP[reply.tier].pips,
    text: tierWords(reply, reply.tier, took).join(' · '),
    tone,
  };
}
