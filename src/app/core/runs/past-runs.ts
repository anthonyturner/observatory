import { Injectable, inject } from '@angular/core';
import { Clock } from '../time/clock';
import { PAST_GONE, endNoteOf } from './run-notes';
import { RunRecord } from './run-record';
import { RUNS_API, RUN_UNKNOWN, messageOf, statusOf } from './runs-api';
import { RunSummary } from './runs.types';

/** Earlier runs held once read. The runner keeps five. */
export const PAST_KEPT = 6;

/** Finished runs already read, by id: a finished run's output never changes,
 *  so each is read from the runner once. */
@Injectable({ providedIn: 'root' })
export class PastRuns {
  private readonly api = inject(RUNS_API);
  private readonly clock = inject(Clock);
  private readonly kept = new Map<string, RunRecord>();

  find(id: string): RunRecord | null {
    return this.kept.get(id) ?? null;
  }

  /** Holds `record`, letting the oldest go past `PAST_KEPT`. */
  keep(record: RunRecord): void {
    this.kept.delete(record.id);
    this.kept.set(record.id, record);
    for (const id of [...this.kept.keys()].slice(0, Math.max(0, this.kept.size - PAST_KEPT))) {
      this.kept.delete(id);
    }
  }

  /** A record for `summary`, filled from its stream: the runner sends
   *  everything it kept of the run, then ends it. */
  load(summary: RunSummary): RunRecord {
    const record = new RunRecord(summary);
    record.setNote(endNoteOf(record.ending(), this.clock.now().getTime()));
    this.keep(record);
    void this.read(record);
    return record;
  }

  private async read(record: RunRecord): Promise<void> {
    try {
      await this.api.follow(record.id, 0, (event) => record.read(event));
    } catch (error: unknown) {
      this.kept.delete(record.id);
      const text =
        statusOf(error) === RUN_UNKNOWN
          ? PAST_GONE
          : `Couldn’t read this run: ${messageOf(error)}.`;
      record.setNote({ text, isBad: true, action: null });
    }
  }
}
