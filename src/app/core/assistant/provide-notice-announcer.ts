import { EnvironmentProviders } from '@angular/core';
import { provideLocalOnly } from '../session/provide-local-only';
import { NoticeAnnouncer } from './notice-announcer';

/** Jev says the news on this machine only. The announcer, and the assistant
 *  it listens to, are made once the API confirms the session is local. */
export function provideNoticeAnnouncer(): EnvironmentProviders {
  return provideLocalOnly(NoticeAnnouncer);
}
