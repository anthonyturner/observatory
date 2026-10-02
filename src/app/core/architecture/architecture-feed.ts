import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of } from 'rxjs';
import { parseArchitecture } from './architecture-parse';
import { ArchitectureState } from './architecture.types';

/** Reads the map once, as a state that never errors. */
export type ArchitectureRead = () => Observable<ArchitectureState>;

const ARCHITECTURE_URL = '/api/architecture';
const HTTP_NOT_FOUND = 404;

const failed = (error: unknown): ArchitectureState =>
  error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
    ? { status: 'missing' }
    : { status: 'unreachable' };

/** One read of the architecture map from Observatory's local API. */
export const ARCHITECTURE_READ = new InjectionToken<ArchitectureRead>('ARCHITECTURE_READ', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return () =>
      http.get<unknown>(ARCHITECTURE_URL).pipe(
        map((body): ArchitectureState => {
          const parsed = parseArchitecture(body);
          return parsed ? { status: 'ready', map: parsed } : { status: 'unreachable' };
        }),
        catchError((error: unknown) => of(failed(error))),
      );
  },
});

/** Where the map stands. It is read once: a new scan shows after the page is reloaded. */
export const ARCHITECTURE_STATE = new InjectionToken<Signal<ArchitectureState>>(
  'ARCHITECTURE_STATE',
  {
    providedIn: 'root',
    factory: () =>
      toSignal(inject(ARCHITECTURE_READ)(), {
        initialValue: { status: 'reading' } satisfies ArchitectureState,
      }),
  },
);
