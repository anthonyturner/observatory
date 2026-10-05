import {
  EnvironmentProviders,
  Injector,
  ProviderToken,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs';
import { ViewerSession } from './viewer-session';

/** Makes `service` once the API confirms the session is local, never on the
 *  session's assumption before it answers, so the hosted site never asks for
 *  anything only this machine has (ADR-0006). */
export function provideLocalOnly(service: ProviderToken<unknown>): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const injector = inject(Injector);
    toObservable(inject(ViewerSession).isConfirmedLocal)
      .pipe(filter(Boolean), take(1), takeUntilDestroyed())
      .subscribe(() => injector.get(service));
  });
}
