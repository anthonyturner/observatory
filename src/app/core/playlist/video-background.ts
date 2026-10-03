import { Injectable, Signal, computed, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.music.video-background';

/** Whether the playing video fills Home's background in place of Milkdrop. Kept
 *  in local storage only; where storage is blocked it lasts for this visit. Only a
 *  page with a backdrop to fill shows it there; elsewhere the bar's card keeps it. */
@Injectable({ providedIn: 'root' })
export class VideoBackground {
  private readonly current = signal(readStored());

  private readonly backdrops = signal(0);

  readonly isOn: Signal<boolean> = this.current.asReadonly();
  /** On, and a backdrop on the page to fill. */
  readonly isShown = computed(() => this.current() && this.backdrops() > 0);

  /** A backdrop arriving on the page; call the returned function as it leaves. */
  holdBackdrop(): () => void {
    this.backdrops.update((count) => count + 1);
    let isHeld = true;
    return () => {
      if (isHeld) this.backdrops.update((count) => count - 1);
      isHeld = false;
    };
  }

  toggle(): void {
    const next = !this.current();
    this.current.set(next);
    store(next);
  }
}

/** Storage is outside the program: anything but 'on' or 'off' reads as off. */
function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function store(isOn: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isOn ? 'on' : 'off');
  } catch {
    return;
  }
}
