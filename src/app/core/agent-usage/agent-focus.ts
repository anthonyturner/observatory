import { Injectable, signal } from '@angular/core';

/** An agent chart on Home a reminder can open. */
export type AgentChart = 'context' | 'daily' | 'rank' | 'grid';

/** A chart to bring into view, narrowed as a nudge or a review step asks. */
export interface ChartTarget {
  readonly chart: AgentChart;
  readonly agent?: string;
  readonly project?: string;
  readonly day?: string;
}

export interface FocusRequest extends ChartTarget {
  /** New each time, so asking for the same chart twice still brings it back. */
  readonly id: number;
}

/** Carries "show me that chart" from the review card and the nudges to the
 *  Agents section, which scrolls to it and narrows it. */
@Injectable({ providedIn: 'root' })
export class AgentFocus {
  private last = 0;
  readonly request = signal<FocusRequest | null>(null);

  show(target: ChartTarget): void {
    this.last++;
    this.request.set({ ...target, id: this.last });
  }

  /** The request has been carried out. */
  clear(): void {
    this.request.set(null);
  }
}
