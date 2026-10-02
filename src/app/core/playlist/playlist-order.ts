/** The track after `index`, back to the first after the last. */
export const nextIndex = (index: number, length: number): number => (index + 1) % length;

/** The track before `index`, round to the last before the first. */
export const previousIndex = (index: number, length: number): number =>
  (index - 1 + length) % length;

/** `count` items of `pool` (all of them if it holds fewer), each at most once, in a
 *  random order: a Fisher–Yates shuffle stopped once it has dealt enough. */
export function pickShuffled<T>(pool: readonly T[], count: number, random: () => number): T[] {
  const deck = [...pool];
  const dealt = Math.min(count, deck.length);
  for (let i = 0; i < dealt; i++) {
    const j = i + Math.floor(random() * (deck.length - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, dealt);
}
