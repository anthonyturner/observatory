import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FILE_SAVER, SavedFile } from '../../../core/files/file-saver';
import { favoritesFileOf } from '../../../core/playlist/favorites-file';
import { FavoritesStore } from '../../../core/playlist/favorites-store';
import { Track } from '../../../core/playlist/playlist.types';
import { Clock } from '../../../core/time/clock';
import {
  FavoritesTransfer,
  NOTHING_TO_EXPORT,
  NOT_AN_EXPORT,
  UNREADABLE,
  importNoticeOf,
} from './favorites-transfer';

const ONE: Track = { videoId: 'aaaaaaaaaaa', title: 'One', artist: 'A', genre: 'trance' };
const TWO: Track = { videoId: 'bbbbbbbbbbb', title: 'Two', artist: 'B', genre: 'techno' };
const THREE: Track = { videoId: 'ccccccccccc', title: 'Three', artist: 'C', genre: 'trance' };
const TODAY = new Date(2026, 9, 3, 21, 30);

class UnreadableFile extends Blob {
  override text(): Promise<string> {
    return Promise.reject(new Error('The file went away'));
  }
}

function setUp() {
  const saved: SavedFile[] = [];
  TestBed.configureTestingModule({
    providers: [
      FavoritesTransfer,
      { provide: FILE_SAVER, useValue: { save: (file: SavedFile) => saved.push(file) } },
      { provide: Clock, useValue: { now: signal(TODAY) } },
    ],
  });
  return {
    saved,
    transfer: TestBed.inject(FavoritesTransfer),
    favorites: TestBed.inject(FavoritesStore),
  };
}

const fileOf = (tracks: readonly unknown[]): Blob =>
  new Blob([JSON.stringify({ format: 'observatory.favorites', version: 1, tracks })]);

describe('FavoritesTransfer', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('saves the favourites to a file named for the day', () => {
    const { saved, transfer, favorites } = setUp();
    favorites.toggle(ONE);
    favorites.toggle(TWO);
    transfer.exportFile();

    expect(saved).toEqual([
      {
        name: 'observatory-favorites-2026-10-03.json',
        text: favoritesFileOf([ONE, TWO], TODAY),
        type: 'application/json',
      },
    ]);
    expect(transfer.notice()).toBe('Exported 2 favourites');
  });

  it('saves nothing, and says why, when there are no favourites', () => {
    const { saved, transfer } = setUp();
    transfer.exportFile();
    expect(saved).toEqual([]);
    expect(transfer.notice()).toBe(NOTHING_TO_EXPORT);
  });

  it('merges a file after the favourites already hearted and counts what it skipped', async () => {
    const { transfer, favorites } = setUp();
    favorites.toggle(TWO);
    transfer.importFile(fileOf([ONE, TWO, { ...THREE, genre: 'polka' }]));

    await vi.waitFor(() => expect(transfer.notice()).not.toBe(''));
    expect(favorites.tracks()).toEqual([TWO, ONE]);
    expect(transfer.notice()).toBe('Added 1 favourite, skipped 2 (1 already saved, 1 not valid)');
  });

  it('changes nothing when the file is not a favourites export', async () => {
    const { transfer, favorites } = setUp();
    favorites.toggle(ONE);
    transfer.importFile(new Blob([JSON.stringify([TWO])]));

    await vi.waitFor(() => expect(transfer.notice()).toBe(NOT_AN_EXPORT));
    expect(favorites.tracks()).toEqual([ONE]);
  });

  it('says so when the file cannot be read', async () => {
    const { transfer } = setUp();
    transfer.importFile(new UnreadableFile());
    await vi.waitFor(() => expect(transfer.notice()).toBe(UNREADABLE));
  });

  it('imports on one site the file another site exported', async () => {
    const first = setUp();
    first.favorites.toggle(ONE);
    first.favorites.toggle(THREE);
    first.transfer.exportFile();
    const text = first.saved[0].text;

    localStorage.clear();
    TestBed.resetTestingModule();
    const second = setUp();
    second.transfer.importFile(new Blob([text]));

    await vi.waitFor(() => expect(second.transfer.notice()).toBe('Added 2 favourites'));
    expect(second.favorites.tracks()).toEqual([ONE, THREE]);
  });

  it('clears the notice after a few seconds', () => {
    vi.useFakeTimers();
    const { transfer } = setUp();
    transfer.exportFile();
    vi.advanceTimersByTime(5999);
    expect(transfer.notice()).toBe(NOTHING_TO_EXPORT);
    vi.advanceTimersByTime(1);
    expect(transfer.notice()).toBe('');
  });
});

describe('importNoticeOf', () => {
  it.each([
    [{ added: 3, alreadySaved: 0, invalid: 0 }, 'Added 3 favourites'],
    [{ added: 1, alreadySaved: 2, invalid: 0 }, 'Added 1 favourite, skipped 2 (2 already saved)'],
    [{ added: 0, alreadySaved: 0, invalid: 1 }, 'Added 0 favourites, skipped 1 (1 not valid)'],
  ])('words %o', (tally, words) => {
    expect(importNoticeOf(tally)).toBe(words);
  });
});
