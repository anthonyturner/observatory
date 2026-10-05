import { type HoldMarker, holdMarker } from './hold-marker.ts';

/** Jev's holds on Agent Speak, one per line he speaks, from any number of tabs. */
export interface JevHold {
  /** Keeps `token`'s hold, and the marker, alive for a few seconds more. */
  renew(token: string): void;
  /** Lets go of `token`'s hold; the marker goes once no hold is left. */
  release(token: string): void;
}

export interface JevHoldOptions {
  readonly marker?: HoldMarker;
  readonly now?: () => number;
}

interface HoldEntry {
  readonly token: string;
  readonly since: number;
  readonly renewedAt: number;
  /** Any word from its tab, renewal or release, refused or not. */
  readonly heardAt: number;
  readonly isReleased: boolean;
}

/** The marker's expiry ahead of each renewal: the page renews every 2 s, so
 *  two can go missing before a live hold lapses, and a dead tab or server
 *  lets Agent Speak go within this. */
export const HOLD_LIFETIME_MS = 6_000;
/** No line of Jev's runs this long, so a hold past it is a page stuck busy. */
export const MAX_HOLD_MS = 5 * 60_000;
/** A released token is kept this long, so a renewal still on its way when the
 *  release landed cannot bring the hold back. */
const FORGET_AFTER_MS = 60_000;

/** The holds, kept in memory, and the marker that tells Agent Speak of them. */
export function jevHold(options: JevHoldOptions = {}): JevHold {
  const marker = options.marker ?? holdMarker();
  const now = options.now ?? Date.now;
  const holds = new Map<string, HoldEntry>();

  const entryOf = (token: string, at: number): HoldEntry =>
    holds.get(token) ?? { token, since: at, renewedAt: at, heardAt: at, isReleased: false };

  const forgetOld = (at: number): void => {
    for (const [token, entry] of holds) {
      if (at - entry.heardAt > FORGET_AFTER_MS) holds.delete(token);
    }
  };

  const mayRenew = (entry: HoldEntry, at: number): boolean =>
    !entry.isReleased && at - entry.since <= MAX_HOLD_MS;

  const latestLive = (at: number): HoldEntry | null =>
    [...holds.values()]
      .filter((entry) => !entry.isReleased && entry.renewedAt + HOLD_LIFETIME_MS > at)
      .reduce<HoldEntry | null>(
        (latest, entry) => (latest && latest.renewedAt >= entry.renewedAt ? latest : entry),
        null,
      );

  const showHolds = (at: number, token: string): void => {
    const latest = latestLive(at);
    if (latest) marker.write(latest.renewedAt + HOLD_LIFETIME_MS, latest.token);
    else marker.clear(at, token);
  };

  return {
    renew(token) {
      const at = now();
      forgetOld(at);
      const entry = entryOf(token, at);
      const renewedAt = mayRenew(entry, at) ? at : entry.renewedAt;
      holds.set(token, { ...entry, renewedAt, heardAt: at });
      showHolds(at, token);
    },
    release(token) {
      const at = now();
      forgetOld(at);
      holds.set(token, { ...entryOf(token, at), heardAt: at, isReleased: true });
      showHolds(at, token);
    },
  };
}
