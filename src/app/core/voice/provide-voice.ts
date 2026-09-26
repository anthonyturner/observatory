import {
  EnvironmentProviders,
  Provider,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { FallbackNotice } from './fallback-notice';
import { REPLY_VOICE } from './reply-voice';
import { SpokenReplies } from './spoken-replies';

/** Replies read aloud, by the voice SPEECH_ENGINE names, with word when the
 *  chosen voice cannot speak. */
export function provideVoice(): (Provider | EnvironmentProviders)[] {
  return [
    { provide: REPLY_VOICE, useExisting: SpokenReplies },
    provideEnvironmentInitializer(() => inject(FallbackNotice)),
  ];
}
