import { Provider } from '@angular/core';
import { CREW_VOICE_SHORTCUT } from './crew-voice';
import { JEV_QUEUE_ACTS } from './jev-queue-acts';
import { QUEUE_TRIAGE_SHORTCUT } from './queue-triage-voice';
import { YES_NO_SHORTCUT } from './yes-no-question';

/** The Review Queue's words on Home: its commands, a crew asked for, the
 *  yes or no both may ask, which the commands cannot work without, and the
 *  same commands when Jev chose them. */
export const REVIEW_QUEUE_SHORTCUTS: Provider[] = [
  YES_NO_SHORTCUT,
  QUEUE_TRIAGE_SHORTCUT,
  CREW_VOICE_SHORTCUT,
  JEV_QUEUE_ACTS,
];
