/** What the hover card needs from the page: which world's card is up, and whether it is pinned. */
export interface CardHoverHost {
  selected(): string | null;
  select(key: string | null): void;
  isPinned(): boolean;
}

export interface HoverTimers {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const BROWSER_TIMERS: HoverTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** The card is docked at the window's edge, so it waits long enough for the
 *  pointer to cross the sky to it. */
export const HIDE_DELAY_MS = 1500;
/** A world passed on the way to the card doesn't take it over; one the
 *  pointer rests on this long does. */
export const SWITCH_DWELL_MS = 220;

/**
 * When a hovered world's card shows, switches and hides. With no card up, a
 * hovered world shows at once. With one up, another world takes over only
 * after the pointer rests on it, and empty sky hides the card only after a
 * linger, so the pointer can travel from a world to its card. A pinned card
 * is left alone.
 */
export class CardHover {
  private hideTimer: unknown = null;
  private switchTimer: unknown = null;
  private switchingTo: string | null = null;

  constructor(
    private readonly host: CardHoverHost,
    private readonly timers: HoverTimers = BROWSER_TIMERS,
  ) {}

  /** The pointer is over `key`'s world, or over empty sky when null. Called on
   *  every move and every frame, so a pending timer is left to run, not restarted. */
  over(key: string | null): void {
    if (this.host.isPinned()) return;
    if (key === null) {
      this.cancelSwitch();
      if (this.host.selected() !== null) this.hideSoon();
      return;
    }
    this.cancelHide();
    const shown = this.host.selected();
    if (key === shown) this.cancelSwitch();
    else if (shown === null) this.host.select(key);
    else this.switchSoon(key);
  }

  /** The pointer is on the card: keep it. */
  hold(): void {
    this.cancel();
  }

  /** The pointer left the card or the sky: let the card go, unless it was pinned. */
  release(): void {
    this.cancelSwitch();
    if (!this.host.isPinned()) this.hideSoon();
  }

  /** A click or a teardown decides the card itself; nothing pending may undo it. */
  cancel(): void {
    this.cancelHide();
    this.cancelSwitch();
  }

  private hideSoon(): void {
    if (this.hideTimer !== null) return;
    this.hideTimer = this.timers.set(() => {
      this.hideTimer = null;
      if (!this.host.isPinned()) this.host.select(null);
    }, HIDE_DELAY_MS);
  }

  private switchSoon(key: string): void {
    if (this.switchingTo === key) return;
    this.cancelSwitch();
    this.switchingTo = key;
    this.switchTimer = this.timers.set(() => {
      this.switchTimer = null;
      this.switchingTo = null;
      if (!this.host.isPinned()) this.host.select(key);
    }, SWITCH_DWELL_MS);
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) this.timers.clear(this.hideTimer);
    this.hideTimer = null;
  }

  private cancelSwitch(): void {
    if (this.switchTimer !== null) this.timers.clear(this.switchTimer);
    this.switchTimer = null;
    this.switchingTo = null;
  }
}
