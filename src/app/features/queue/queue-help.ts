import { HelpEntry, HelpKey } from '../../shared/help/help-entry';

export const QUEUE_HELP_ENTRIES: readonly HelpEntry[] = [
  {
    term: 'Order',
    meaning:
      'One constellation per state, most urgent on the left: Aporia cannot merge, Ruina checks failing, Nebulosa mergeability unknown, Vagrans no issue linked, Vigilia waiting on you, Quies seen recently. The list view keeps the same order.',
  },
  {
    term: 'Stars',
    meaning:
      'One star per open pull request. A bigger star has sat untouched longer. Blocked stars send out a slow ring. ✦ marks a quick win: waiting on you, known size, under 200 lines.',
  },
  {
    term: 'Legend',
    meaning:
      'Press a count to light only that state, or quick wins; press it again for everything. Snoozed and dismissed pull requests leave the sky until "hidden · Show" brings them back.',
  },
  {
    term: 'Changes',
    meaning:
      'What changed since you last looked: a white flash for a new pull request, a red shockwave for one that became blocked, green rings falling from one unblocked. The card lists them with merges and closures. Got it clears them. Your last visit is kept in this browser only.',
  },
  {
    term: 'Threads',
    meaning:
      'A red thread with a spark joins two pull requests that would conflict with each other, found by merging them in a local clone. A faint dashed thread joins two that change the same file but could not be checked. Two that merge cleanly have no thread.',
  },
  {
    term: 'Panel',
    meaning:
      'Click a star or a row for its pull request: checks, review, the issues it closes, what it collides with, and its description. GitHub opens in a new tab.',
  },
  {
    term: 'Triage',
    meaning:
      'Mark seen moves a pull request waiting on you to Quies. Snooze hides it for a day or a week; Dismiss hides it until it changes. Kept on this machine; nothing is written to GitHub.',
  },
  {
    term: 'Motion',
    meaning:
      'Follows your system’s reduced-motion setting until you press it; then it remembers your choice. Off, the sky holds still and the rings stand where they are.',
  },
  {
    term: 'Sound',
    meaning:
      'An ambient score made in this browser as you listen, uneasy as your projects strain. Off until you turn it on, and remembered.',
  },
];

export const QUEUE_HELP_KEYS: readonly HelpKey[] = [
  { key: '?', action: 'help' },
  { key: 'Esc', action: 'close' },
  { key: '← → ↑ ↓', action: 'move' },
  { key: '+ −', action: 'zoom' },
];
