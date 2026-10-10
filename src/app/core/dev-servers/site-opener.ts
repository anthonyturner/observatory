import { DOCUMENT, InjectionToken, inject } from '@angular/core';

/** Opens a running site in a browser tab. */
export interface SiteOpener {
  /** Opens `url` in a new tab; false when the browser blocked it. */
  open(url: string): boolean;
}

/**
 * Called when the server reports its site is up, long after the click that
 * asked for it, so a browser may block the tab as a pop-up. `noopener` is not
 * passed to `open`, because it makes `open` return null even when the tab
 * opened and then nothing tells a blocked tab from an opened one. The tab's
 * `opener` is cleared at once instead: the site is another project's code and
 * has no business reaching back.
 */
export const SITE_OPENER = new InjectionToken<SiteOpener>('SiteOpener', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    return {
      open: (url) => {
        const tab = view?.open(url, '_blank');
        if (!tab) return false;
        tab.opener = null;
        return true;
      },
    };
  },
});
