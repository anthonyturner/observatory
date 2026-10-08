import { InjectionToken, inject } from '@angular/core';
import { MilestonesQuietTab } from '../../core/milestones/milestones-quiet-tab';
import { QuietTab } from './quiet-tab';

/**
 * Every tab that can recede. Given here by default rather than in the app's
 * providers, so the check loads with the strip, on a project's screen, and
 * adds nothing to the start-up bundle. A test swaps the list through the token.
 */
export const QUIET_TABS = new InjectionToken<readonly QuietTab[]>('QUIET_TABS', {
  factory: () => [inject(MilestonesQuietTab)],
});
