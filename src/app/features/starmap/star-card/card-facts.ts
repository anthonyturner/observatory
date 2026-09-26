import { QueueItem } from '../../../core/queue/queue-report';
import { SkyPair } from '../engine/collision-layer';
import { QUICK_COLOUR, costOf, isQuick } from '../engine/sky-model';
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
}

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
  const facts: CardFact[] = [...collisionFacts(item.number, context.pairs)];
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
      : { term: 'closes', value: 'nothing', tone: 'bad' },
  );
  facts.push({ term: 'idle', value: `${item.idleDays} days` });
  facts.push({ term: 'age', value: `${item.ageDays} days` });
  if (item.branch) facts.push({ term: 'branch', value: item.branch });
  facts.push({
    term: 'state',
    value: `${item.isDraft ? 'draft' : 'ready'} · ${(item.mergeable || 'unknown').toLowerCase()}`,
  });
  return facts;
}
