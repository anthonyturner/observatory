/** Moves `from` toward `to` at `rate` per second, over `stepS` seconds. */
export function follow(from: number, to: number, rate: number, stepS: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * stepS));
}
