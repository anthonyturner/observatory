let lane: Promise<unknown> = Promise.resolve();

/** One run at a time, whichever model it is for, warm-ups included. The
 *  runtime's WebAssembly build suspends mid-run while the graphics card
 *  works, and does not promise to survive a second run entering it. */
export function inLane<T>(work: () => Promise<T>): Promise<T> {
  const turn = lane.then(work);
  lane = turn.catch(() => undefined);
  return turn;
}
