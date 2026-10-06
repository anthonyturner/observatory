import { QueueItem } from '../../../core/queue/queue-report';
import { SkyPair } from '../engine/collision-layer';
import { QUICK_COLOUR, costOf, isQuick } from '../engine/sky-model';
import { isFalling } from '../engine/black-hole';
import { skyItemOf } from '../sky-items';

/** One line of the card's facts: a term, what it says, and how it reads. */
export interface CardFact {
  readonly term: string;
  readonly value: string;
  /** `bad` in the conflict colour, `hot` in the card's own. */
  readonly tone?: 'bad' | 'hot';
  /** A colour of its own, as the quick-win size has. */
  readonly colour?: string;
}

/** What the rest of the sky says about one pull request. */
export interface CardContext {
  readonly pairs: readonly SkyPair[];
  /** Other shown pull requests closing the same issue, by issue. */
  readonly binaries: readonly { readonly issue: number; readonly others: readonly number[] }[];
  /** While a past refresh is on screen: when it was, and where the pull request stands now. */
  readonly replay?: { readonly at: string; readonly now: string; readonly live: boolean };
  /** Where it falls in the merge plan: step and of how many. */
  readonly planStep?: { readonly step: number; readonly of: number };
  /** The news the sky carries about it, if any. */
  readonly change?: { readonly noun: string; readonly label: string; readonly colour: string };
  /** Idle days past which the black hole pulls a pull request in. */
  readonly staleAfterDays?: number;
}

/** How long it has sat idle, said as a fall once the black hole has it. */
function idleFact(idleDays: number, staleAfterDays: number | undefined): CardFact {
  return staleAfterDays !== undefined && isFalling(idleDays, staleAfterDays)
    ? { term: 'falling in', value: `idle ${idleDays} days`, tone: 'hot' }
    : { term: 'idle', value: `${idleDays} days` };
}

/** "Sep 26, 04:16 AM". */
const fmtAt = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const list = (numbers: readonly number[]): string => numbers.map((n) => `#${n}`).join(', ');

function collisionFacts(pr: number, pairs: readonly SkyPair[]): CardFact[] {
  const mine = pairs.filter((p) => p.a === pr || p.b === pr);
  const other = (p: SkyPair): number => (p.a === pr ? p.b : p.a);
  const hard = mine.filter((p) => p.conflict === true).map(other);
  const soft = mine.filter((p) => p.conflict !== true).map(other);
  return [
    ...(hard.length ? [{ term: 'collides', value: list(hard), tone: 'bad' as const }] : []),
    ...(soft.length ? [{ term: 'shares files', value: list(soft) }] : []),
  ];
}

/** The card's facts, in pr-starmap's order and words. */
export function cardFacts(item: QueueItem, context: CardContext): CardFact[] {
  const sky = skyItemOf(item);
  const cost = costOf(sky);
  const quick = isQuick(sky);
  const files = item.changedFiles ?? 0;
  const { replay, change } = context;
  const facts: CardFact[] = [];
  if (replay) {
    facts.push({ term: 'as of', value: fmtAt(replay.at), tone: 'hot' });
    facts.push({ term: 'now', value: replay.now });
  }
  if (change) {
    facts.push({
      term: 'change',
      value: `${change.noun} ${change.label}`,
      colour: change.colour === '#ffffff' ? undefined : change.colour,
    });
  }
  if (!replay) facts.push(...collisionFacts(item.number, context.pairs));
  if (!replay && context.planStep) {
    facts.push({
      term: 'merge order',
      value: `${context.planStep.step} of ${context.planStep.of}`,
    });
  }
  for (const binary of context.binaries) {
    facts.push({
      term: 'binary',
      value: `${list(binary.others)} also close${binary.others.length > 1 ? '' : 's'} #${binary.issue}`,
      tone: 'hot',
    });
  }
  if (cost != null) {
    facts.push({
      term: 'size',
      value: `+${item.additions} −${item.deletions} · ${files} file${files === 1 ? '' : 's'}${quick ? ' · quick win' : ''}`,
      colour: quick ? QUICK_COLOUR : undefined,
    });
  }
  facts.push(
    item.closes.length
      ? { term: 'closes', value: item.closes.map((n) => `#${n}`).join(' ') }
      : replay && !replay.live
        ? { term: 'closes', value: '—' }
        : { term: 'closes', value: 'nothing', tone: 'bad' },
  );
  facts.push(idleFact(item.idleDays, context.staleAfterDays));
  facts.push({ term: 'age', value: `${item.ageDays} days` });
  if (item.branch) facts.push({ term: 'branch', value: item.branch });
  if (replay) return facts;
  facts.push({
    term: 'state',
    value: `${item.isDraft ? 'draft' : 'ready'} · ${(item.mergeable || 'unknown').toLowerCase()}`,
  });
  return facts;
}
