import { HelpEntry, HelpKey } from '../../shared/help/help-entry';

export const ORRERY_HELP_ENTRIES: readonly HelpEntry[] = [
  {
    term: 'Worlds',
    meaning:
      'One world per project you own, in its most urgent colour. A bigger world has more open work.',
  },
  {
    term: 'Orbits',
    meaning:
      'The most urgent sit innermost, and distance is neglect: a world moves out a step for each day its oldest pull request has sat untouched, up to ten weeks. Outer worlds come round more slowly.',
  },
  {
    term: 'Moons',
    meaning:
      'One moon per blocked pull request, up to six. A ring means branches that no longer merge. Comets trailing a world are its unclaimed issues.',
  },
  {
    term: 'Card',
    meaning:
      'Point at a world for its card: its counts, Review queue, and Show on Home. Click a world to open its review queue; on a touch screen, tap once for the card and again to open it.',
  },
  {
    term: 'Motion',
    meaning:
      'Follows your system’s reduced-motion setting until you press it; then it remembers your choice. Off, the system holds still.',
  },
  {
    term: 'Sound',
    meaning:
      'An ambient score made in this browser as you listen, uneasy as your projects strain. Off until you turn it on, and remembered.',
  },
];

export const ORRERY_HELP_KEYS: readonly HelpKey[] = [
  { key: '?', action: 'help' },
  { key: 'Esc', action: 'close' },
  { key: '← → ↑ ↓', action: 'move' },
  { key: '+ −', action: 'zoom' },
];
