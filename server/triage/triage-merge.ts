import type { TriageState } from './triage.ts';

type Entries = Record<string, string>;

const keysOf = (state: TriageState): string[] => [
  ...Object.keys(state.seen),
  ...Object.keys(state.dismissed),
  ...Object.keys(state.snoozed),
  ...Object.keys(state.changed),
];

/** Copies `from`'s entry for `key` into `to`, or leaves `to` without one. */
function copyEntry(to: Entries, from: Readonly<Entries>, key: string): void {
  if (key in from) to[key] = from[key];
}

/**
 * Two copies of one repository's triage as one. Triage is decided in two
 * places, here and on the hosted site, so each pull request takes the copy
 * that changed it last, whole: a restore or an unseen is a choice too, and is
 * not undone by an older mark from the other side. A tie, or a pull request
 * neither copy has a time for, keeps `ours`.
 */
export function mergeTriage(ours: TriageState, theirs: TriageState): TriageState {
  const merged = { seen: {}, dismissed: {}, snoozed: {}, changed: {} } as {
    seen: Entries;
    dismissed: Entries;
    snoozed: Entries;
    changed: Entries;
  };
  for (const key of new Set([...keysOf(ours), ...keysOf(theirs)])) {
    const winner = (theirs.changed[key] ?? '') > (ours.changed[key] ?? '') ? theirs : ours;
    copyEntry(merged.seen, winner.seen, key);
    copyEntry(merged.dismissed, winner.dismissed, key);
    copyEntry(merged.snoozed, winner.snoozed, key);
    copyEntry(merged.changed, winner.changed, key);
  }
  return merged;
}
