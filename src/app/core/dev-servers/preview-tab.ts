import { DOCUMENT, InjectionToken, inject } from '@angular/core';

/** A browser tab opened for a site that is still starting. */
export interface PreviewTab {
  /** Points the tab at the site. */
  show(url: string): void;
  /** Closes the tab, for a site that never came up. */
  close(): void;
}

/** Opens tabs for previews. */
export interface PreviewTabs {
  /** Must be called from the click that asked for the site. */
  open(): PreviewTab;
}

const NO_TAB: PreviewTab = { show: () => undefined, close: () => undefined };

/**
 * A tab opened later, once the server reports its address, is not tied to the
 * click any more and a browser blocks it as a pop-up. So the tab is opened blank
 * at the click and pointed at the site when it is ready. Its `opener` is cleared
 * at once: the site is another project's code and has no business reaching back.
 */
export const PREVIEW_TABS = new InjectionToken<PreviewTabs>('PreviewTabs', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    return {
      open: () => {
        const tab = view?.open('about:blank', '_blank');
        if (!tab) return NO_TAB;
        tab.opener = null;
        return {
          show: (url) => tab.location.replace(url),
          close: () => tab.close(),
        };
      },
    };
  },
});
