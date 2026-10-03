import {
  EnvironmentProviders,
  Provider,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { ANNOUNCEMENT_VOICE } from './announcement-voice';
import { FallbackNotice } from './fallback-notice';
import { REPLY_VOICE } from './reply-voice';
import { SpokenReplies } from './spoken-replies';

/** Replies and announcements read aloud, by the voice SPEECH_ENGINE names,
 *  with word when the chosen voice cannot speak a reply. */
export function provideVoice(): (Provider | EnvironmentProviders)[] {
  return [
    { provide: REPLY_VOICE, useExisting: SpokenReplies },
    { provide: ANNOUNCEMENT_VOICE, useExisting: SpokenReplies },
    provideEnvironmentInitializer(() => inject(FallbackNotice)),
  ];
}
