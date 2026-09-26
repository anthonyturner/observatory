import { RunEventListener, RunsApi } from '../runs-api';
import { RunEvent, RunSummary, RunsReport, StartRequest } from '../runs.types';
import { lineOf } from './run-fixtures';

/** One follow call: where it asked from, and how to answer it. */
export interface FollowCall {
  readonly id: string;
  readonly from: number;
  readonly send: (events: readonly RunEvent[]) => void;
  readonly end: () => void;
  readonly fail: (error: unknown) => void;
  readonly signal: AbortSignal | undefined;
}

/** A runner for tests: each follow waits for the test to answer it, and the
 *  other calls answer as their fields say. */
export class FakeRunsApi implements RunsApi {
  readonly follows: FollowCall[] = [];
  readonly cancelled: string[] = [];
  readonly started: StartRequest[] = [];
  report: RunsReport = { current: null, recent: [] };
  listCalls = 0;
  cancelAnswer: (id: string) => Promise<RunSummary> = () => Promise.reject(new Error('not set'));
  startAnswer: () => Promise<RunSummary> = () => Promise.reject(new Error('not set'));

  async list(): Promise<RunsReport> {
    this.listCalls++;
    return this.report;
  }

  start(request: StartRequest): Promise<RunSummary> {
    this.started.push(request);
    return this.startAnswer();
  }

  cancel(id: string): Promise<RunSummary> {
    this.cancelled.push(id);
    return this.cancelAnswer(id);
  }

  follow(id: string, from: number, onEvent: RunEventListener, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.follows.push({
        id,
        from,
        send: (events) => events.forEach((event) => onEvent(event, lineOf(event))),
        end: resolve,
        fail: reject,
        signal,
      });
    });
  }
}
