import { InjectionToken, Signal, signal } from '@angular/core';

export type StatusState = 'idle' | 'active' | 'error';

/** One reading on the status line; a state gives it a coloured dot. */
export interface StatusItem {
  readonly label: string;
  readonly state?: StatusState;
}

/** What Home's top bar says about the system as a whole. */
export interface HomeSummary {
  readonly stamp: string;
  readonly statuses: readonly StatusItem[];
}

export const SAMPLE_HOME_SUMMARY: HomeSummary = {
  stamp: '2 blocked · 3 projects · 14 open · refreshed 09:42',
  statuses: [
    { label: 'Core · Idle', state: 'idle' },
    { label: 'Local' },
    { label: '3 projects tracked' },
  ],
};

/** Where Home reads its summary from: sample data until the live source lands. */
export const HOME_SUMMARY = new InjectionToken<Signal<HomeSummary>>('HOME_SUMMARY', {
  providedIn: 'root',
  factory: () => signal(SAMPLE_HOME_SUMMARY).asReadonly(),
});
