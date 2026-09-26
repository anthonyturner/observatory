import { Provider } from '@angular/core';
import { CORE_STATE_SOURCES } from './core-state-tokens';
import { AskCoreSource } from './sources/ask-core-source';
import { RunCoreSource } from './sources/run-core-source';
import { SpeechCoreSource } from './sources/speech-core-source';
import { TalkCoreSource } from './sources/talk-core-source';

/** What drives the core on Home. A new source is one more line here. */
export function provideCoreStateSources(): Provider[] {
  return [
    { provide: CORE_STATE_SOURCES, useClass: AskCoreSource, multi: true },
    { provide: CORE_STATE_SOURCES, useClass: TalkCoreSource, multi: true },
    { provide: CORE_STATE_SOURCES, useClass: SpeechCoreSource, multi: true },
    { provide: CORE_STATE_SOURCES, useClass: RunCoreSource, multi: true },
  ];
}
