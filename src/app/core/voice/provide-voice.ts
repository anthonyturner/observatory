import { Provider } from '@angular/core';
import { REPLY_VOICE } from './reply-voice';
import { SpokenReplies } from './spoken-replies';

/** Replies read aloud, by the voice SPEECH_ENGINE names. */
export function provideVoice(): Provider[] {
  return [{ provide: REPLY_VOICE, useExisting: SpokenReplies }];
}
