import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VoiceCatalog } from './voice-catalog';

/** Why ElevenLabs could not turn a recording into words, as a clause. */
export class HearingFailed extends Error {
  constructor(readonly words: string) {
    super(words);
    this.name = 'HearingFailed';
  }
}

/** Sends a recording to ElevenLabs Scribe through the site and gets the words back. */
export type HearClip = (clip: Blob) => Promise<string>;

const HEAR_URL = '/api/voice/hear';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });
const NO_ANSWER = 'the site didn’t answer';
const HTTP_NO_ANSWER = 0;
/** Bytes turned to base64 this many at a time, well inside a call's argument limit. */
const CHUNK = 0x8000;

function base64Of(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function failureOf(error: unknown): unknown {
  if (!(error instanceof HttpErrorResponse)) return error;
  if (error.status === HTTP_NO_ANSWER) return new HearingFailed(NO_ANSWER);
  const said: unknown = error.error;
  const words = typeof said === 'object' && said ? Reflect.get(said, 'error') : null;
  return new HearingFailed(
    typeof words === 'string' && words ? words : `the site answered ${error.status}`,
  );
}

export const HEAR_CLIP = new InjectionToken<HearClip>('HearClip', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return async (clip) => {
      const audio = base64Of(new Uint8Array(await clip.arrayBuffer()));
      try {
        const answer = await firstValueFrom(
          http.post<unknown>(
            HEAR_URL,
            { audio, type: clip.type || 'audio/webm' },
            { headers: WRITE_HEADERS },
          ),
        );
        const text: unknown =
          typeof answer === 'object' && answer ? Reflect.get(answer, 'text') : null;
        if (typeof text !== 'string') throw new HearingFailed('its answer was not readable');
        return text;
      } catch (error: unknown) {
        throw failureOf(error);
      }
    };
  },
});

/** Speech into words by ElevenLabs, billed to the same account as the voice,
 *  while the site says ElevenLabs is on. After one failure this visit hears
 *  with Whisper in the browser instead, and `failure` says why. */
@Injectable({ providedIn: 'root' })
export class ElevenLabsHearing {
  private readonly catalog = inject(VoiceCatalog);
  private readonly hearClip = inject(HEAR_CLIP);
  private readonly failed = signal<string | null>(null);

  /** Why ElevenLabs stopped hearing this visit, or null. */
  readonly failure: Signal<string | null> = this.failed.asReadonly();
  readonly isAvailable: Signal<boolean> = computed(
    () => this.catalog.state().status === 'on' && this.failed() === null,
  );

  /** The words in `clip`. On failure, remembers why and rejects with HearingFailed. */
  async hear(clip: Blob): Promise<string> {
    try {
      return await this.hearClip(clip);
    } catch (error: unknown) {
      const words = error instanceof HearingFailed ? error.words : 'it failed';
      this.failed.set(words);
      throw error instanceof HearingFailed ? error : new HearingFailed(words);
    }
  }
}
