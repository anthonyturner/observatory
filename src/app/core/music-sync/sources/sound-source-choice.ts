import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { SOUND_SOURCES } from './sound-sources';
import { SoundOption, SoundSource } from './sound-source.types';

const STORAGE_KEY = 'observatory.music.sound-source';
const DETAIL_SEPARATOR = ':';

/** A source this browser can use, with its entries for the chooser. */
export interface SoundMenuGroup {
  readonly source: SoundSource;
  readonly options: readonly SoundOption[];
}

/** The entry Sync will open, and the source it belongs to. */
export interface SoundSelection {
  readonly source: SoundSource;
  readonly option: SoundOption;
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

/** The picked entry if it is on offer; else the first entry of its own source,
 *  as when a device it named is gone; else the first entry of all. */
function selectionOf(
  menu: readonly SoundMenuGroup[],
  picked: string | null,
): SoundSelection | null {
  for (const { source, options } of menu) {
    const option = options.find(({ id }) => id === picked);
    if (option) return { source, option };
  }
  const owner = menu.find(({ source }) => source.id === sourceIdOf(picked)) ?? menu[0];
  return owner ? { source: owner.source, option: owner.options[0] } : null;
}

function sourceIdOf(optionId: string | null): string | null {
  return optionId?.split(DETAIL_SEPARATOR)[0] ?? null;
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
