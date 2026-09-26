/** One line of the help card: a short term and what it means on Home. */
export interface HelpEntry {
  readonly term: string;
  readonly meaning: string;
}

/** A key and what it does, for the card's foot. */
export interface HelpKey {
  readonly key: string;
  readonly action: string;
}

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
    term: 'Dots',
    meaning:
      'One dot per project on the ring round the core, in card order clockwise from twelve: blocked first, ringed. A bigger dot has more open work. Point at a dot, or at its card, to see its name.',
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
      'An ambient score made in this browser as you listen, with a hum that pulses with the core. Off until you turn it on, and remembered.',
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
