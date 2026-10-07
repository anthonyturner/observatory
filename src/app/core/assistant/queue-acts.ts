import { InjectionToken } from '@angular/core';
import { QueueAct } from './assistant.types';

/** Carries out a Review Queue command Jev chose, as the page would the typed one. */
export interface QueueActs {
  carryOut(entryId: number, act: QueueAct): void;
}

/** Provided with the Review Queue's commands, so Home's assistant can hand Jev's to them. */
export const QUEUE_ACTS = new InjectionToken<QueueActs>('QUEUE_ACTS');
