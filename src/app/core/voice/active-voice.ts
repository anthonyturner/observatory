import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { VoiceCatalog } from './voice-catalog';
import { CatalogState, CatalogVoice } from './voice-catalog.types';
import { VoiceChoice } from './voice-choice';

/** Who reads replies now. An ElevenLabs voice is null until the account's
 *  voices are read. */
export type Speaker =
  | { readonly engine: 'kokoro' }
  | { readonly engine: 'elevenlabs'; readonly voice: CatalogVoice | null };

const KOKORO: Speaker = { engine: 'kokoro' };

/** Why ElevenLabs cannot speak, as the first half of "…, so Kokoro speaks." */
const NOT_HERE = 'ElevenLabs isn’t available here';
const OFF = 'ElevenLabs is off: no key';
const NO_VOICES = 'ElevenLabs has no voices on this account';
const failedToList = (words: string): string => `ElevenLabs couldn’t list its voices: ${words}`;

/** Why the catalog rules ElevenLabs out, or null while it may speak. */
function blockerOf(catalog: CatalogState): string | null {
  switch (catalog.status) {
    case 'reading':
      return null;
    case 'unavailable':
      return NOT_HERE;
    case 'off':
      return OFF;
    case 'on':
      if (catalog.failed) return failedToList(catalog.failed);
      return catalog.voices.length ? null : NO_VOICES;
  }
}

/** The chosen voice while the account still has it, else the account's default. */
export function voiceToUse(chosen: string | null, catalog: CatalogState): CatalogVoice | null {
  if (catalog.status !== 'on') return null;
  const listed = (id: string | null): CatalogVoice | undefined =>
    catalog.voices.find((voice) => voice.id === id);
  return listed(chosen) ?? listed(catalog.defaultVoice) ?? null;
}

/** The voice replies are read in: the viewer's choice while ElevenLabs can
 *  speak, and Kokoro for the rest of the visit once it cannot. */
@Injectable({ providedIn: 'root' })
export class ActiveVoice {
  private readonly catalog = inject(VoiceCatalog);
  private readonly choice = inject(VoiceChoice);
  private readonly failure = signal<string | null>(null);

  readonly elevenLabsVoice: Signal<CatalogVoice | null> = computed(() =>
    voiceToUse(this.choice.voice(), this.catalog.state()),
  );
  /** Why ElevenLabs cannot speak on this visit; null while it can, or may. */
  readonly blocker: Signal<string | null> = computed(
    () => this.failure() ?? blockerOf(this.catalog.state()),
  );
  /** Why Kokoro speaks though the viewer chose ElevenLabs; else null. */
  readonly fallbackReason: Signal<string | null> = computed(() =>
    this.choice.engine() === 'elevenlabs' ? this.blocker() : null,
  );
  readonly speaker: Signal<Speaker> = computed(() =>
    this.choice.engine() === 'elevenlabs' && this.blocker() === null
      ? { engine: 'elevenlabs', voice: this.elevenLabsVoice() }
      : KOKORO,
  );

  /** ElevenLabs failed: Kokoro speaks for the rest of the visit. */
  fallBack(reason: string): void {
    this.failure.set(reason);
  }
}
