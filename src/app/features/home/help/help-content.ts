import { HelpEntry, HelpKey } from '../../../shared/help/help-entry';

export const HOME_HELP_ENTRIES: readonly HelpEntry[] = [
  {
    term: 'Order',
    meaning:
      'Blocked first, then the ones GitHub has not worked out or could not read, then the rest.',
  },
  {
    term: 'Counts',
    meaning:
      'On your own machine a card can differ for a few minutes from the project’s star map. Refresh brings them level.',
  },
  {
    term: 'Comets',
    meaning:
      'Each comet falling behind the core is one open issue, in its project’s colour. More issues make a heavier rain; closing one takes its comet away.',
  },
  {
    term: 'Mood',
    meaning:
      'The core’s mood follows your projects: calm, slow green when nothing is blocked; quicker, deeper breathing, warming toward amber, as blocked projects and stuck PRs pile up. Grey until the projects are read. The line under CLAUDE says why.',
  },
  {
    term: 'Ripple',
    meaning:
      'A wave rolls across the floor each time fresh project data arrives, about every five minutes. No ripple for a long while means the data has stopped coming.',
  },
  {
    term: 'Progress',
    meaning:
      'When a refresh shows issues closed or pull requests merged since the last one, that project’s dot bursts green and green comets flare into the core, one per thing done.',
  },
  {
    term: 'Fog',
    meaning:
      'Home fogs over as its project data ages: nothing for six hours, full by three days. A line under the core says how old the data is. Fresh data clears it.',
  },
  {
    term: 'Dots',
    meaning:
      'One dot per project on the ring round the core, in card order clockwise from twelve: blocked first, ringed. A bigger dot has more open work. Point at a dot, or at its card, to see its name; click a dot to go to its card. A dot fades, with a slow grey pulsing ring, once its oldest pull request has sat untouched for a week.',
  },
  {
    term: 'Core',
    meaning:
      'Drag the ball to turn it; flick it and it coasts. The points near your pointer light up. With the core focused, the arrow keys turn it.',
  },
  {
    term: 'Motion',
    meaning:
      'Follows your system’s reduced-motion setting until you press it; then it remembers your choice. Off, everything holds still.',
  },
  {
    term: 'Sound',
    meaning:
      'An ambient score made in this browser as you listen, with a hum that pulses with the core. It follows the core’s mood: a low, wavering unease rises under it as projects strain. Off until you turn it on, and remembered.',
  },
  {
    term: 'Ask',
    meaning:
      'Type a request and press Enter. Plainly named app actions are matched by keyword; Jev, a small model that sorts requests, decides the rest. Each reply says which tier it took and how.',
  },
  {
    term: 'Arcs',
    meaning:
      'The three arcs round the ball are the tiers. They light in turn while Home works a request out, then the tier the reply took stays lit for a moment.',
  },
  {
    term: 'Tier 1',
    meaning:
      '●○○ An app action: open a page, refresh, help. Matched without calling any model when you name it plainly.',
  },
  {
    term: 'Tier 2',
    meaning: '●●○ A quick answer from a small model. Labelled as one, and it can be wrong.',
  },
  {
    term: 'Tier 3',
    meaning:
      '●●● Work in a project. Home shows the command that runs it as a Claude Code task, for you to run in the project’s folder.',
  },
  {
    term: 'Talk',
    meaning:
      'Press Tap to talk once to start and again to stop, or hold it and let go to send. No audio leaves this browser.',
  },
  {
    term: 'Speak',
    meaning:
      'Reads actions and quick answers aloud, in this browser. Off until you turn it on, and remembered.',
  },
];

export const HOME_HELP_KEYS: readonly HelpKey[] = [
  { key: '?', action: 'help' },
  { key: 'Esc', action: 'close' },
  { key: '← → ↑ ↓', action: 'turn the core' },
];
