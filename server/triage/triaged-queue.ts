import { BadRequest } from '../http/api-handler.ts';
import type { QueueItem, QueueReport } from '../queue/queue-report.ts';
import { type PullTriage, type TriageRequest, applyTriage, triageOf } from './triage.ts';
import type { TriageStore } from './triage-store.ts';

/** A queue item with its triage. */
export type TriagedItem = QueueItem & PullTriage;

export interface TriagedQueue extends Omit<QueueReport, 'items'> {
  readonly items: readonly TriagedItem[];
}

/** The queue with each pull request's triage merged in, as it stands now. */
export async function withTriage(
  report: QueueReport,
  store: TriageStore,
  now: number,
): Promise<TriagedQueue> {
  const state = await store.read(report.repo);
  return {
    ...report,
    items: report.items.map((item) => ({
      ...item,
      ...triageOf(state, item.number, item.updatedAt, now),
    })),
  };
}

/** Records a triage action on an open pull request, and returns where it now stands. */
export async function recordTriage(
  request: TriageRequest,
  report: QueueReport,
  store: TriageStore,
  now: number,
): Promise<PullTriage & { readonly number: number }> {
  const item = report.items.find((each) => each.number === request.number);
  if (!item)
    throw new BadRequest(`#${request.number} is not an open pull request in ${request.repo}`);
  const state = applyTriage(await store.read(request.repo), request.number, request.action, {
    now,
    updatedAt: item.updatedAt,
    days: request.days,
  });
  await store.write(request.repo, state);
  return { number: request.number, ...triageOf(state, item.number, item.updatedAt, now) };
}
