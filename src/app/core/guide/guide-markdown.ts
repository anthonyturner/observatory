import { InjectionToken } from '@angular/core';
// Bundled as text at build time, so the Guide reads the same on the local and
// hosted sites with no request, and only its own lazy chunk carries it.
import guideMarkdown from '../../../../docs/guide.md' with { loader: 'text' };

/** The Guide's text: `docs/guide.md`, the one copy the wiki publishes too. */
export const GUIDE_MARKDOWN = new InjectionToken<string>('GUIDE_MARKDOWN', {
  providedIn: 'root',
  factory: () => guideMarkdown,
});
