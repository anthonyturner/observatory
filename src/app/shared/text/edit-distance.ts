/** How many single-letter insertions, deletions or substitutions turn `from`
 *  into `to` (the Levenshtein distance). */
export function editDistance(from: string, to: string): number {
  let previous = Array.from({ length: to.length + 1 }, (_, index) => index);
  for (let row = 1; row <= from.length; row++) {
    const current = [row];
    for (let column = 1; column <= to.length; column++) {
      const substitution = previous[column - 1] + (from[row - 1] === to[column - 1] ? 0 : 1);
      current.push(Math.min(previous[column] + 1, current[column - 1] + 1, substitution));
    }
    previous = current;
  }
  return previous[to.length];
}
