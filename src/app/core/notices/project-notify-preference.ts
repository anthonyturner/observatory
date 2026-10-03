import { DOCUMENT, DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subscription, filter, fromEvent, timer } from 'rxjs';
import { BROWSER_NOTICES, askToNotify } from '../agent-usage/browser-notices';
import { PageVisibility } from '../presence/page-visibility';

const STORAGE_KEY = 'observatory.project-notify';
const ON = 'on';
const OFF = 'off';
/** How long the status line stays empty before a refusal is written into it
 *  again: a screen reader announces only a change it has seen, so the same
 *  words written back at once would go unsaid. */
const REWRITE_MS = 150;

/**
 * Whether merged pull requests and new issues are also sent as desktop
 * notifications: off until asked for, remembered in this browser across its
 * tabs, and on only while the browser allows them.
 */
@Injectable({ providedIn: 'root' })
export class ProjectNotifyPreference {
  private readonly notices = inject(BROWSER_NOTICES);
  private readonly destroyRef = inject(DestroyRef);
  private readonly wanted = signal(readStoredChoice());
  private readonly permission = signal(this.notices.permission());
  private readonly refused = signal(false);
  private pendingRefusal: Subscription | null = null;

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
      .subscribe(() => this.readPermission());
    // Another tab's choice arrives as it stores it, with the permission it was given.
    const view = inject(DOCUMENT).defaultView;
    if (!view) return;
    fromEvent<StorageEvent>(view, 'storage')
      .pipe(
        filter(({ key }) => key === STORAGE_KEY || key === null),
        takeUntilDestroyed(),
      )
      .subscribe(({ newValue }) => {
        this.wanted.set(newValue === ON);
        this.readPermission();
      });
  }

  /** Asks the browser if it has not been asked yet, so call it from a click. The
   *  answer is kept here even if the caller has gone; the Observable says when. */
  turnOn(): Observable<void> {
    this.clearRefusal();
    return askToNotify(this.notices, (isAllowed) => this.keepAnswer(isAllowed), this.destroyRef);
  }

  turnOff(): void {
    this.clearRefusal();
    this.choose(false);
  }

  private keepAnswer(isAllowed: boolean): void {
    this.readPermission();
    this.choose(isAllowed);
    if (!isAllowed) {
      this.pendingRefusal = timer(REWRITE_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.refused.set(true));
    }
  }

  private clearRefusal(): void {
    this.pendingRefusal?.unsubscribe();
    this.pendingRefusal = null;
    this.refused.set(false);
  }

  private readPermission(): void {
    this.permission.set(this.notices.permission());
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
