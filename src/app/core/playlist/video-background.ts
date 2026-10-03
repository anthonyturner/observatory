import { Injectable, Signal, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.music.video-background';

/** Whether the playing video fills Home's background in place of Milkdrop. Kept
 *  in local storage only; where storage is blocked it lasts for this visit. */
@Injectable({ providedIn: 'root' })
export class VideoBackground {
  private readonly current = signal(readStored());

  readonly isOn: Signal<boolean> = this.current.asReadonly();

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
