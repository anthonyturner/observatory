import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { FILE_SAVER } from '../../../core/files/file-saver';
import {
  FAVORITES_FILE_TYPE,
  favoritesFileNameOf,
  favoritesFileOf,
  readFavoritesFile,
} from '../../../core/playlist/favorites-file';
import { FavoritesStore } from '../../../core/playlist/favorites-store';
import { Clock } from '../../../core/time/clock';

/** Long enough to read a two-part count, short enough not to linger over the video. */
const NOTICE_MS = 6000;

export const NOTHING_TO_EXPORT = 'No favourites to export yet: heart a track first';
export const NOT_AN_EXPORT = 'That file is not an Observatory favourites export; nothing changed';
export const UNREADABLE = 'That file could not be read; nothing changed';

/** How an import went: tracks added, valid ones already hearted, and entries not tracks. */
export interface ImportTally {
  readonly added: number;
  readonly alreadySaved: number;
  readonly invalid: number;
}

/** Carries the hearted tracks between copies of Observatory as a file: saves them,
 *  merges a saved file back in, and words the outcome. Provided by the transport bar. */
@Injectable()
export class FavoritesTransfer {
  private readonly favorites = inject(FavoritesStore);
  private readonly saver = inject(FILE_SAVER);
  private readonly clock = inject(Clock);
  private readonly shown = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly notice: Signal<string> = this.shown.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  exportFile(): void {
    const count = this.favorites.count();
    if (count === 0) {
      this.show(NOTHING_TO_EXPORT);
      return;
    }
    const today = this.clock.now();
    this.saver.save({
      name: favoritesFileNameOf(today),
      text: favoritesFileOf(this.favorites.tracks(), today),
      type: FAVORITES_FILE_TYPE,
    });
    this.show(`Exported ${favouritesOf(count)}`);
  }

  importFile(file: Blob): void {
    file.text().then(
      (text) => this.importText(text),
      () => this.show(UNREADABLE),
    );
  }

  private importText(text: string): void {
    const read = readFavoritesFile(text);
    if (!read.isExport) {
      this.show(NOT_AN_EXPORT);
      return;
    }
    const before = this.favorites.count();
    this.favorites.addAll(read.tracks);
    const added = this.favorites.count() - before;
    this.show(
      importNoticeOf({ added, alreadySaved: read.tracks.length - added, invalid: read.invalid }),
    );
  }

  private show(words: string): void {
    clearTimeout(this.timer);
    this.shown.set(words);
    this.timer = setTimeout(() => this.shown.set(''), NOTICE_MS);
  }
}

export function importNoticeOf({ added, alreadySaved, invalid }: ImportTally): string {
  const reasons = [
    ...(alreadySaved > 0 ? [`${alreadySaved} already saved`] : []),
    ...(invalid > 0 ? [`${invalid} not valid`] : []),
  ];
  const skipped = alreadySaved + invalid;
  const addedWords = `Added ${favouritesOf(added)}`;
  return skipped === 0 ? addedWords : `${addedWords}, skipped ${skipped} (${reasons.join(', ')})`;
}

function favouritesOf(count: number): string {
  return count === 1 ? '1 favourite' : `${count} favourites`;
}
