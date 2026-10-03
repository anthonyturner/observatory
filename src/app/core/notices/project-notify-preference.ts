import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, filter, map, tap } from 'rxjs';
import { BROWSER_NOTICES, permissionToNotify } from '../agent-usage/browser-notices';
import { PageVisibility } from '../presence/page-visibility';

const STORAGE_KEY = 'observatory.project-notify';
const ON = 'on';
const OFF = 'off';

/**
 * Whether merged pull requests and new issues are also sent as desktop
 * notifications: off until asked for, remembered in this browser, and on only
 * while the browser allows them.
 */
@Injectable({ providedIn: 'root' })
export class ProjectNotifyPreference {
  private readonly notices = inject(BROWSER_NOTICES);
  private readonly wanted = signal(readStoredChoice());
  private readonly permission = signal(this.notices.permission());
  private readonly refused = signal(false);

  readonly isSupported: boolean = this.notices.permission() !== 'unsupported';
  /** Wanted and allowed: permission taken back in the browser's settings shows it off. */
  readonly isOn: Signal<boolean> = computed(() => this.wanted() && this.permission() === 'granted');
  /** The browser said no the last time it was turned on. */
  readonly isRefused: Signal<boolean> = this.refused.asReadonly();

  constructor() {
    // Settings are changed away from the tab, so its permission is read again on return.
    toObservable(inject(PageVisibility).isHidden)
      .pipe(
        filter((isHidden) => !isHidden),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.permission.set(this.notices.permission()));
  }

  /** Asks the browser if it has not been asked yet, so subscribe from a click;
   *  a refusal leaves it off. */
  turnOn(): Observable<void> {
    return permissionToNotify(this.notices).pipe(
      tap((isAllowed) => {
        this.permission.set(this.notices.permission());
        this.refused.set(!isAllowed);
        this.choose(isAllowed);
      }),
      map(() => undefined),
    );
  }

  turnOff(): void {
    this.refused.set(false);
    this.choose(false);
  }

  private choose(isWanted: boolean): void {
    this.wanted.set(isWanted);
    storeChoice(isWanted);
  }
}

/** Private windows and blocked site data throw here; it then starts off. */
function readStoredChoice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === ON;
  } catch {
    return false;
  }
}

/** Where storage is blocked the choice lasts for this visit only. */
function storeChoice(isWanted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isWanted ? ON : OFF);
  } catch {
    return;
  }
}
