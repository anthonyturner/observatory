import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { sourceIdOf } from './option-id';
import { SOUND_SOURCES } from './sound-sources';
import { SoundOption, SoundSource } from './sound-source.types';

const STORAGE_KEY = 'observatory.music.sound-source';

/** A source this browser can use, with its entries for the chooser. */
export interface SoundMenuGroup {
  readonly source: SoundSource;
  readonly options: readonly SoundOption[];
}

/** The entry Sync will open, and the source it belongs to. */
export interface SoundSelection {
  readonly source: SoundSource;
  readonly option: SoundOption;
  /** The entry picked is gone from a list its source could read in full, as when
   *  a device is unplugged, so this is its source's own entry instead. */
  readonly isPickGone: boolean;
}

/** Where Sync hears the music: the entry last picked in this browser, kept in
 *  local storage; where storage is blocked it lasts for this visit. Until one is
 *  picked, or while the picked one is not on offer, it is the first on offer. */
@Injectable({ providedIn: 'root' })
export class SoundSourceChoice {
  private readonly sources = inject(SOUND_SOURCES);
  private readonly picked = signal(readStored());

  /** The sources this browser can use now, in the chooser's order. */
  readonly menu: Signal<readonly SoundMenuGroup[]> = computed(() =>
    this.sources
      .map((source) => ({ source, options: source.options() }))
      .filter((group) => group.options.length > 0),
  );
  /** Null where no source can be used, as on a phone. */
  readonly selected: Signal<SoundSelection | null> = computed(() =>
    selectionOf(this.menu(), this.picked()),
  );
  /** Whether there is more than one entry to choose between. */
  readonly hasChoice = computed(
    () => this.menu().reduce((count, { options }) => count + options.length, 0) > 1,
  );

  choose(optionId: string): void {
    this.picked.set(optionId);
    store(optionId);
  }
}

/** The picked entry if it is on offer; else its own source's entry, as when a
 *  device it named is gone; else the first entry of all. */
function selectionOf(
  menu: readonly SoundMenuGroup[],
  picked: string | null,
): SoundSelection | null {
  for (const { source, options } of menu) {
    const option = options.find(({ id }) => id === picked);
    if (option) return { source, option, isPickGone: false };
  }
  const owner =
    picked === null ? undefined : menu.find(({ source }) => source.id === sourceIdOf(picked));
  if (owner) return fallbackWithin(owner);
  const first = menu[0];
  return first ? { source: first.source, option: first.options[0], isPickGone: false } : null;
}

/** A source that lists only its own entry has not been let read its list (the
 *  browser hides device names until access is granted), so it cannot tell a pick
 *  is gone. */
function fallbackWithin({ source, options }: SoundMenuGroup): SoundSelection {
  const own = options.find(({ id }) => id === source.id);
  const isListed = options.some(({ id }) => id !== source.id);
  return { source, option: own ?? options[0], isPickGone: isListed };
}

/** Storage is outside the program; an id no source offers falls back as above. */
function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(optionId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, optionId);
  } catch {
    return;
  }
}
