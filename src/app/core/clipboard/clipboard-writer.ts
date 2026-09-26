import { DOCUMENT, InjectionToken, inject } from '@angular/core';

/** Puts text on the system clipboard; rejects where the browser refuses. */
export interface ClipboardWriter {
  write(text: string): Promise<void>;
}

export const CLIPBOARD_WRITER = new InjectionToken<ClipboardWriter>('ClipboardWriter', {
  providedIn: 'root',
  factory: () => {
    const clipboard = inject(DOCUMENT).defaultView?.navigator.clipboard;
    return {
      write: (text) =>
        clipboard ? clipboard.writeText(text) : Promise.reject(new Error('No clipboard here')),
    };
  },
});
