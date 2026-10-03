import {
  EnvironmentProviders,
  Injector,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs';
import { ViewerSession } from '../session/viewer-session';
import { NoticeAnnouncer } from './notice-announcer';

/** Jev says the news on this machine only (ADR-0006). The announcer, and the
 *  assistant it listens to, are made once the API confirms the session is
 *  local, never on the session's assumption before it answers, so the hosted
 *  site never asks for an assistant it does not have. */
export function provideNoticeAnnouncer(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const injector = inject(Injector);
    toObservable(inject(ViewerSession).isConfirmedLocal)
      .pipe(filter(Boolean), take(1))
      .subscribe(() => injector.get(NoticeAnnouncer));
  });
}
