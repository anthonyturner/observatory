import { Injectable, Signal, computed, inject } from '@angular/core';
import { Clock } from '../time/clock';
import { PROJECTS_STATE } from './projects-source';

/* A snapshot does not announce its own age. As on pr-starmap, the page fogs
   over as the projects report ages: nothing for six hours, full by three days. */
const FOG_START_H = 6;
const FOG_FULL_H = 72;
const HOUR_MS = 3_600_000;
const DAYS_FROM_H = 48;

/** How fogged the page is, 0 to 1, for a report made at `generatedAt`. */
export function fogLevel(generatedAt: string, now: Date): number {
  const made = Date.parse(generatedAt);
  if (Number.isNaN(made)) return 0;
  const hours = (now.getTime() - made) / HOUR_MS;
  return Math.max(0, Math.min(1, (hours - FOG_START_H) / (FOG_FULL_H - FOG_START_H)));
}

/** "9 hours" under two days, "3 days" after. */
export function ageWords(generatedAt: string, now: Date): string {
  const hours = Math.floor((now.getTime() - Date.parse(generatedAt)) / HOUR_MS);
  if (hours < DAYS_FROM_H) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.floor(hours / 24);
  return `${days} days`;
}

export interface DataFog {
  /** 0 clear to 1 full. */
  readonly level: number;
  /** "9 hours", while there is fog. */
  readonly age: string | null;
}

const CLEAR: DataFog = { level: 0, age: null };

/** How old the projects report is, as fog. Clear while there is no report:
 *  the numbers then say unknown themselves. */
@Injectable({ providedIn: 'root' })
export class DataAge {
  private readonly state = inject(PROJECTS_STATE);
  private readonly clock = inject(Clock);

  readonly fog: Signal<DataFog> = computed(() => {
    const state = this.state();
    if (state.status !== 'ready') return CLEAR;
    const now = this.clock.now();
    const level = fogLevel(state.report.generatedAt, now);
    return level > 0 ? { level, age: ageWords(state.report.generatedAt, now) } : CLEAR;
  });
}
