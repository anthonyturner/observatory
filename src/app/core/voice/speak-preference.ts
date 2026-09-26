import { Injectable, Signal, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.speak';

/** Whether replies are read aloud. Off until asked for, as Sound is, and
 *  remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class SpeakPreference {
  private readonly on = signal(readStoredChoice());

  readonly isOn: Signal<boolean> = this.on.asReadonly();

  turnOn(): void {
    this.on.set(true);
    storeChoice(true);
  }

  turnOff(): void {
    this.on.set(false);
    storeChoice(false);
  }

  /** Off for this visit only, when the viewer did not choose it: the next
   *  visit starts as they left it. */
  turnOffForVisit(): void {
    this.on.set(false);
  }
}

/** Private windows and blocked site data throw here; Speak then starts off. */
function readStoredChoice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Where storage is blocked the choice lasts for this visit only. */
function storeChoice(isOn: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isOn ? 'on' : 'off');
  } catch {
    return;
  }
}
