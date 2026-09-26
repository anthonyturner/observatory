import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UNAVAILABLE, parseCatalog } from './voice-catalog-parse';
import { CatalogState } from './voice-catalog.types';

const VOICE_URL = '/api/voice';

/** Whether ElevenLabs can speak here, and in which voices. Read once a
 *  visit: the list is free, and the site keeps it for ten minutes anyway. */
@Injectable({ providedIn: 'root' })
export class VoiceCatalog {
  private readonly http = inject(HttpClient);
  private readonly current = signal<CatalogState>({ status: 'reading' });

  readonly state: Signal<CatalogState> = this.current.asReadonly();
  /** Settles, never rejects, once the site has answered or failed to. */
  readonly whenRead: Promise<CatalogState> = this.read();

  /** A refusal (the hosted preview's 403 to a visitor) or no answer at all
   *  means no ElevenLabs here, never an error. */
  private async read(): Promise<CatalogState> {
    const state = await firstValueFrom(this.http.get<unknown>(VOICE_URL)).then(
      parseCatalog,
      () => UNAVAILABLE,
    );
    this.current.set(state);
    return state;
  }
}
