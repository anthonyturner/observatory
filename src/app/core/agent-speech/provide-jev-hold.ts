import { EnvironmentProviders } from '@angular/core';
import { provideLocalOnly } from '../session/provide-local-only';
import { JevHoldBeacon } from './jev-hold-beacon';

/** Jev holds Agent Speak on this machine only, where it runs; the hosted
 *  site sends no hold at all. */
export function provideJevHold(): EnvironmentProviders {
  return provideLocalOnly(JevHoldBeacon);
}
