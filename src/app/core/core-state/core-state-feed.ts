import { Directive, inject } from '@angular/core';
import { CORE_STATE_SOURCES } from './core-state-tokens';
import { provideCoreStateSources } from './provide-core-state-sources';

/** Connects the core's sources for as long as its host is on the page. */
@Directive({
  selector: '[appCoreStateFeed]',
  providers: [provideCoreStateSources()],
})
export class CoreStateFeed {
  constructor() {
    for (const source of inject(CORE_STATE_SOURCES)) source.connect();
  }
}
