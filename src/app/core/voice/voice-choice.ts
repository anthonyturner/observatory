import { Injectable, Signal, computed, signal } from '@angular/core';

/** Which voice reads replies: Kokoro in this browser, or ElevenLabs on the site. */
export type VoiceEngineId = 'kokoro' | 'elevenlabs';

interface StoredChoice {
  readonly engine: VoiceEngineId;
  /** The ElevenLabs voice last chosen; the account's default until then. */
  readonly voice: string | null;
}

const STORAGE_KEY = 'observatory.voice';
const ENGINES: readonly VoiceEngineId[] = ['kokoro', 'elevenlabs'];
/** The owner reads replies in their ElevenLabs voice, so a browser starts
 *  there; Kokoro stands in whenever ElevenLabs cannot speak (see ActiveVoice). */
const FIRST_CHOICE: StoredChoice = { engine: 'elevenlabs', voice: null };

/** The reply voice the viewer picked, remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class VoiceChoice {
  private readonly chosen = signal(readStoredChoice());

  readonly engine: Signal<VoiceEngineId> = computed(() => this.chosen().engine);
  readonly voice: Signal<string | null> = computed(() => this.chosen().voice);

  chooseEngine(engine: VoiceEngineId): void {
    this.save({ ...this.chosen(), engine });
  }

  chooseVoice(voice: string): void {
    this.save({ ...this.chosen(), voice });
  }

  private save(choice: StoredChoice): void {
    this.chosen.set(choice);
    storeChoice(choice);
  }
}

function parseChoice(stored: string | null): StoredChoice {
  const choice: unknown = stored ? JSON.parse(stored) : null;
  if (typeof choice !== 'object' || choice === null) return FIRST_CHOICE;
  const engine: unknown = Reflect.get(choice, 'engine');
  const voice: unknown = Reflect.get(choice, 'voice');
  return {
    engine: ENGINES.find((known) => known === engine) ?? FIRST_CHOICE.engine,
    voice: typeof voice === 'string' && voice !== '' ? voice : null,
  };
}

/** Private windows and blocked site data throw here, and an edited value may
 *  not parse; either way the browser starts with ElevenLabs. */
function readStoredChoice(): StoredChoice {
  try {
    return parseChoice(localStorage.getItem(STORAGE_KEY));
  } catch {
    return FIRST_CHOICE;
  }
}

/** Where storage is blocked the choice lasts for this visit only. */
function storeChoice(choice: StoredChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    return;
  }
}
