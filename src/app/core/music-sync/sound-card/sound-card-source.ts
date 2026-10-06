import { HttpClient } from '@angular/common/http';
import { InjectionToken, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { STREAM_FETCH } from '../../runs/runs-api';
import { AudioTapOpener } from '../tab-audio';
import { openSoundCard } from './sound-card-audio';

const STATUS_URL = '/api/sound-card';

/** Opens this computer's sound card, streamed by the local API. */
export const SOUND_CARD_TAP = new InjectionToken<AudioTapOpener>('SOUND_CARD_TAP', {
  providedIn: 'root',
  factory: () => {
    const fetchStream = inject(STREAM_FETCH);
    return () => openSoundCard(fetchStream);
  },
});

const isAvailableReport = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && Reflect.get(body, 'available') === true;

/**
 * Whether the API can stream this computer's sound card: only the local
 * server on Windows can. False until it says so, and wherever it cannot be
 * asked, as on the hosted site, which has no such route.
 */
export const SOUND_CARD_AVAILABLE = new InjectionToken<Signal<boolean>>('SOUND_CARD_AVAILABLE', {
  providedIn: 'root',
  factory: () =>
    toSignal(
      inject(HttpClient)
        .get<unknown>(STATUS_URL)
        .pipe(
          map(isAvailableReport),
          catchError(() => of(false)),
        ),
      { initialValue: false },
    ),
});
