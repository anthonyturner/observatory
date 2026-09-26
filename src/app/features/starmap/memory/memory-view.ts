import { DOCUMENT, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LedgerFeed } from '../../../core/queue/ledger-feed';
import {
  EFFECTS,
  MemoryItem,
  NewsEvent,
  baseline,
  diffItems,
  frameItems,
  knownFates,
} from './news';

const SEEN_KEY = 'observatory.seen.';
/** Leaving after a real look counts as having seen it; a glance does not. */
const REAL_LOOK_MS = 20_000;
const PLAYER_STEP_MS = 2600;
const PLAYER_STEP_STILL_MS = 1400;

/** A past refresh on screen: which frame, when, and its queue as it was. */
export interface Replay {
  readonly index: number;
  readonly at: string;
  readonly items: readonly MemoryItem[];
}

/** What the sky is carrying as news, and whether the viewer has seen it. */
export interface NewsState {
  readonly events: readonly NewsEvent[];
  readonly label: string;
  readonly since: string | null;
  readonly acknowledged: boolean;
}

const NO_NEWS: NewsState = { events: [], label: '', since: null, acknowledged: false };

/** When this browser last looked at a repository: the snapshot it saw. */
function readSeen(repo: string): string | null {
  try {
    return localStorage.getItem(SEEN_KEY + repo);
  } catch {
    return null;
  }
}

function writeSeen(repo: string, at: string): void {
  try {
    localStorage.setItem(SEEN_KEY + repo, at);
  } catch {
    // Per visit only.
  }
}

/**
 * pr-starmap's memory on the star map page: the news since you last looked,
 * announced once when the queue and its frames are both in, and replay of
 * every recorded refresh. It decides what happened; the sky plays it.
 */
@Injectable()
export class MemoryView {
  private repo = '';
  private snapshotAt: string | null = null;
  private announced = false;
  private liveNews: NewsState | null = null;
  private player: ReturnType<typeof setInterval> | null = null;
  private readonly openedAt = Date.now();

  private readonly history = inject(HistoryFeed);
  private readonly ledgerFeed = inject(LedgerFeed);

  readonly frames = this.history.frames;
  readonly framesLoaded = this.history.loaded;
  readonly ledger = this.ledgerFeed.ledger;
  readonly news = signal<NewsState>(NO_NEWS);
  readonly replay = signal<Replay | null>(null);
  readonly playing = signal(false);
  readonly lastSeen = signal<string | null>(null);
  /** Plays a set of events on the sky; the page connects it to the sky. */
  onPlay: (events: readonly NewsEvent[]) => void = () => undefined;

  readonly canReplay = computed(() => this.frames().length >= 2);

  constructor() {
    const leave = (): void => {
      if (Date.now() - this.openedAt > REAL_LOOK_MS && !this.replay()) this.markSeen();
    };
    const window = inject(DOCUMENT).defaultView;
    window?.addEventListener('pagehide', leave);
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('pagehide', leave);
      this.stopPlayer();
    });
  }

  /** A new repository starts afresh. */
  watch(repo: string): void {
    this.repo = repo;
    this.announced = false;
    this.snapshotAt = null;
    this.stopPlayer();
    this.replay.set(null);
    this.news.set(NO_NEWS);
    this.liveNews = null;
    this.lastSeen.set(readSeen(repo));
  }

  /**
   * Once, when both the snapshot and its frames are in: what changed since
   * the baseline. Returns the events, for the page to frame and play.
   */
  announce(snapshotAt: string, visible: readonly MemoryItem[]): readonly NewsEvent[] {
    this.snapshotAt = snapshotAt;
    if (this.announced || !this.framesLoaded() || this.replay()) return [];
    this.announced = true;
    const frames = this.frames();
    const base = baseline(frames, this.lastSeen(), snapshotAt);
    if (!base) return [];
    const shown = new Set(visible.map((i) => i.pr));
    const events = diffItems(frameItems(base.frame), visible, knownFates(frames, this.ledger()))
      // A pull request dismissed since is not news the viewer asked for.
      .filter((e) => !EFFECTS[e.kind].onStar || shown.has(e.pr));
    this.news.set({ events, label: base.label, since: base.since, acknowledged: false });
    return events;
  }

  /** Got it: the viewer has seen this, so the marks clear and the visit counts. */
  acknowledge(): void {
    if (!this.replay()) this.markSeen();
    this.news.update((news) => ({ ...news, acknowledged: true }));
  }

  playAgain(): void {
    this.onPlay(this.news().events);
  }

  /**
   * Puts refresh `index` on screen, or the live sky for null. The news always
   * describes what that refresh changed against the one before, the same story
   * whichever way the viewer arrived.
   */
  showFrame(index: number | null): void {
    if (!this.replay()) this.liveNews = this.news();
    const frames = this.frames();
    const frame = index === null ? null : frames[index];
    if (!frame || index === null) {
      this.replay.set(null);
      this.news.set(this.liveNews ?? this.news());
      this.onPlay(this.news().events);
      return;
    }
    this.replay.set({ index, at: frame.at, items: frameItems(frame) });
    const prev = frames[index - 1];
    const fates = knownFates(frames, this.ledger());
    for (const d of frame.departed) fates.set(d.number, d.fate);
    const events = prev ? diffItems(frameItems(prev), frameItems(frame), fates) : [];
    this.news.set({
      events,
      label: `refresh ${index + 1} of ${frames.length}`,
      since: prev?.at ?? null,
      acknowledged: false,
    });
    this.onPlay(events);
  }

  /** Steps through every recorded refresh, oldest first, then returns to now. */
  togglePlayer(frozen: boolean): void {
    if (this.player) return this.stopPlayer();
    const frames = this.frames();
    if (frames.length < 2) return;
    const replay = this.replay();
    let i = replay && replay.index < frames.length - 1 ? replay.index : 0;
    this.showFrame(i);
    this.playing.set(true);
    this.player = setInterval(
      () => {
        i += 1;
        if (i >= this.frames().length) {
          this.stopPlayer();
          this.showFrame(null);
          return;
        }
        this.showFrame(i);
      },
      frozen ? PLAYER_STEP_STILL_MS : PLAYER_STEP_MS,
    );
  }

  stopPlayer(): void {
    if (this.player) clearInterval(this.player);
    this.player = null;
    this.playing.set(false);
  }

  /** `[` and `]`: one refresh back or forward; past the newest is now. */
  step(direction: -1 | 1): void {
    this.stopPlayer();
    const n = this.frames().length;
    if (!n) return;
    const current = this.replay()?.index ?? n;
    const next = Math.max(0, Math.min(n, current + direction));
    if (next === current) return;
    this.showFrame(next >= n ? null : next);
  }

  /** Leaving the review queue: replay belongs to it, so the live sky returns, unplayed. */
  endReplay(): void {
    this.stopPlayer();
    if (!this.replay()) return;
    this.replay.set(null);
    this.news.set(this.liveNews ?? this.news());
  }

  /** Back to the sky as it is now. */
  live(): void {
    this.stopPlayer();
    if (this.replay()) this.showFrame(null);
  }

  private markSeen(): void {
    if (!this.snapshotAt || !this.repo) return;
    writeSeen(this.repo, this.snapshotAt);
    this.lastSeen.set(this.snapshotAt);
  }
}
