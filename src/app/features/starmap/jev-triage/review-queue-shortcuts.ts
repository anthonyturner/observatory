import { Provider } from '@angular/core';
import { CREW_VOICE_SHORTCUT } from './crew-voice';
import { QUEUE_TRIAGE_SHORTCUT } from './queue-triage-voice';
import { YES_NO_SHORTCUT } from './yes-no-question';

/** The Review Queue's words on Home: its commands, a crew asked for, and the
 *  yes or no both may ask, which the commands cannot work without. */
export const REVIEW_QUEUE_SHORTCUTS: Provider[] = [
  YES_NO_SHORTCUT,
  QUEUE_TRIAGE_SHORTCUT,
  CREW_VOICE_SHORTCUT,
];
