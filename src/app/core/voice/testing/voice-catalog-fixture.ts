import { Provider, WritableSignal, signal } from '@angular/core';
import { VoiceCatalog } from '../voice-catalog';
import { CatalogState, CatalogVoice } from '../voice-catalog.types';

export const RACHEL: CatalogVoice = { id: 'rachel01', name: 'Rachel' };
export const ADAM: CatalogVoice = { id: 'adam02', name: 'Adam' };

/** ElevenLabs on, with Rachel and Adam, Rachel the default. */
export const ELEVENLABS_ON: CatalogState = {
  status: 'on',
  voices: [RACHEL, ADAM],
  defaultVoice: RACHEL.id,
  failed: null,
};

/** A catalog already read as `state`, whose state a test can change. */
export function fakeCatalog(state: CatalogState): {
  readonly state: WritableSignal<CatalogState>;
  readonly provider: Provider;
} {
  const current = signal(state);
  const catalog = { state: current, whenRead: Promise.resolve(state) };
  return { state: current, provider: { provide: VoiceCatalog, useValue: catalog } };
}
