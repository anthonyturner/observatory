import { HelpEntry, HelpKey } from '../../../shared/help/help-entry';

const TIER_3 = 'Tier 3';

const HOME_HELP_ENTRIES: readonly HelpEntry[] = [
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
      'An ambient score made in this browser as you listen, with a hum that pulses with the core. Each project on the ring chimes in its own slow rhythm, busier with more open work, in an instrument that says its state and from where its dot sits; pointing at a project plays its motif. A low, wavering unease rises under it as projects strain. Off until you turn it on, and remembered.',
  },
  {
    term: 'Ask',
    meaning:
      'Type a request and press Enter. Plainly named app actions are matched by keyword; Jev answers the rest, looking up your projects, usage or the web as it needs, and remembers this visit’s conversation. A web answer lists its sources under it: click one to read it in a floating window you can drag and resize (Ctrl-click opens a tab instead). Each reply says which tier it took and how.',
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
    meaning:
      '●●○ Jev’s answer, from Claude Haiku. It looks up your projects and usage itself, remembers this visit’s conversation, and can be wrong.',
  },
  {
    term: TIER_3,
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
      'Reads actions and Jev’s answers aloud, in this browser. Off until you turn it on, and remembered.',
  },
];

/** Where the local site can run a task, tier 3 says so, and its lines follow. */
const RUN_HELP_ENTRIES: readonly HelpEntry[] = [
  {
    term: TIER_3,
    meaning:
      '●●● Work in a project. Home shows the task, the project folder it would run in and the command, and runs it as a Claude Code task only when you press Run. When no project is named, it asks which.',
  },
  {
    term: 'Run',
    meaning:
      'Run arms after a moment, then a click, or Enter or Space on Run itself, starts the task. Nothing else does: not Enter anywhere else, and never your voice. A proposal lasts 5 minutes, and one task runs at a time.',
  },
  {
    term: 'Task',
    meaning:
      'A running task has a panel on the right: its state, its time against the 30-minute limit, and what Claude Code does as it happens. It runs with your own Claude Code permissions and hooks. Hide folds the panel into the pill at the top; the core shows Working while it runs.',
  },
  {
    term: 'Tools',
    meaning:
      'Each tool Claude uses is one line: its name and what it was called with, marked ○ while it runs, ✓ once it worked, ✕ if it failed. Press a line to see the call and what came back. Claude’s own words read as plain text between them. The run ends with a green block (the result, the time, the cost and the turns), or a red one if it stopped with an error.',
  },
  {
    term: 'Refused',
    meaning:
      'An amber Not allowed block, marked ⊘, is a tool Claude wanted that your Claude Code settings don’t allow. It was not done, and Claude carried on without it; the count sits under the title. A dashed Expected block is one of your own hooks asking Claude to write where a run from Home can’t: skipped, and nothing to worry about.',
  },
  {
    term: 'Hooks',
    meaning:
      'Your own Claude Code hooks run in every task. They fold into one Hooks line; press it for each hook and how it went.',
  },
  {
    term: 'Recent',
    meaning:
      'Recent runs, under the output, lists the task running now and the last five that finished since the local site started, with their time and cost. Press one to read it again; Back returns to the current run. With no task running, the pill at the top opens them. Reloading the page picks a running task up where this tab left it.',
  },
  {
    term: 'Cancel',
    meaning:
      'Cancel run stops the task and everything it started, at once. Changes it already made stay made. Esc never cancels a task.',
  },
];

/** Home's help card: with a local runner, tier 3 runs here and says how. */
export function homeHelpEntries(canRun: boolean): readonly HelpEntry[] {
  if (!canRun) return HOME_HELP_ENTRIES;
  const tier3 = HOME_HELP_ENTRIES.findIndex((entry) => entry.term === TIER_3);
  return [
    ...HOME_HELP_ENTRIES.slice(0, tier3),
    ...RUN_HELP_ENTRIES,
    ...HOME_HELP_ENTRIES.slice(tier3 + 1),
  ];
}

export const HOME_HELP_KEYS: readonly HelpKey[] = [
  { key: '/', action: 'ask' },
  { key: '?', action: 'help' },
  { key: 'Esc', action: 'close, throw a recording away, stay here or stop speaking' },
  { key: '← → ↑ ↓', action: 'turn the core' },
];
