import { DOCUMENT, InjectionToken, inject } from '@angular/core';

/** A file made in the page, to hand to the browser as a download. */
export interface SavedFile {
  readonly name: string;
  readonly text: string;
  readonly type: string;
}

/** Hands a file to the browser to download. */
export interface FileSaver {
  save(file: SavedFile): void;
}

export const FILE_SAVER = new InjectionToken<FileSaver>('FileSaver', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return { save: (file) => download(document, file) };
  },
});

function download(document: Document, { name, text, type }: SavedFile): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Revoked a turn later: a browser may only start reading the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url));
}
