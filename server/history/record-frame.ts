import type { FateReader } from '../github/fate-reader.ts';
import type { QueueReport } from '../queue/queue-report.ts';
import { mapWithLimit } from '../util/map-with-limit.ts';
import {
  type Departed,
  type Frame,
  fateFrom,
  frameItemsOf,
  isWorthRecording,
  leftSince,
} from './frames.ts';
import type { HistoryStore } from './history-store.ts';

/** GitHub is asked about departures a few at a time. */
const FATE_CONCURRENCY = 4;

/** Records the queue as a frame when it is worth one, asking GitHub how each
 *  pull request that left it left. Returns the frame, or null if none was due. */
export async function recordFrame(
  report: QueueReport,
  store: HistoryStore,
  github: FateReader,
  now: number,
): Promise<Frame | null> {
  const previous = (await store.read(report.repo)).at(-1) ?? null;
  const items = frameItemsOf(report);
  if (!isWorthRecording(previous, items, now)) return null;
  const fates = await mapWithLimit(leftSince(previous, items), FATE_CONCURRENCY, async (item) => {
    const pull = await github.pullState(report.repo, item.number).catch(() => null);
    const fate = fateFrom(pull?.state ?? '');
    return fate ? { number: item.number, title: item.title, fate } : null;
  });
  const frame: Frame = {
    at: new Date(now).toISOString(),
    items,
    departed: fates.filter((departed): departed is Departed => departed !== null),
  };
  await store.append(report.repo, frame);
  return frame;
}
