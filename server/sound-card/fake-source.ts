import type { PcmEvents, PcmSource } from './pcm-source.ts';

/** A capture a test drives by hand, counting how often it was started and stopped. */
export function handSource() {
  const counts = { starts: 0, stops: 0 };
  let events: PcmEvents | null = null;
  const source: PcmSource = (given) => {
    counts.starts += 1;
    events = given;
    return () => {
      counts.stops += 1;
    };
  };
  /** What the running capture reports to. */
  const live = (): PcmEvents => {
    if (!events) throw new Error('the source was never started');
    return events;
  };
  return { source, counts, live };
}
