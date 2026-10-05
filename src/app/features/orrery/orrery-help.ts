import { HelpEntry, HelpKey } from '../../shared/help/help-entry';

export const ORRERY_HELP_ENTRIES: readonly HelpEntry[] = [
  {
    term: 'Worlds',
    meaning:
      'One world per project you own. Its air glows in its most urgent colour; a bigger world has more open work.',
  },
  {
    term: 'Night side',
    meaning:
      'City lights are work in motion: more open pull requests, more lights, dimming as the oldest goes stale. Glowing fissures mean checks are failing. The kind of world, its land, its clouds and the Milky Way behind are only scenery.',
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
    term: 'Notices',
    meaning:
      'A notice appears under the clock when a pull request merges or an issue opens in any project. For a desktop notification as well while this tab is in the background, tick Notify me in Home’s Projects heading.',
  },
  {
    term: 'Motion',
    meaning:
      'Follows your system’s reduced-motion setting until you press it; then it remembers your choice. Off, the system holds still.',
  },
  {
    term: 'Sound',
    meaning:
      'The system plays itself. Each world is an instrument with its own rhythm, busier with more open work; its sound says its state: harsh when blocked, a bell when clear. Each plays from where it sits, the sun keeps the beat, and a scanner sweep rises with blocked worlds. Pointing at a world plays its motif.',
  },
];

export const ORRERY_HELP_KEYS: readonly HelpKey[] = [
  { key: '?', action: 'help' },
  { key: 'Esc', action: 'close' },
  { key: '← → ↑ ↓', action: 'move' },
  { key: '+ −', action: 'zoom' },
  { key: 'F8', action: 'go to the notifications' },
];
