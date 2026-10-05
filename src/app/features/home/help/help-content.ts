import { HelpEntry, HelpKey } from '../../../shared/help/help-entry';

const TIER_3 = 'Tier 3';
const ASK = 'Ask';
/** What each thing in the scene stands for, first, then how to work Home. */
const SKY = 'The sky';
const AGENTS = 'Agents';
const USING = 'Using Home';

const HOME_HELP_ENTRIES: readonly HelpEntry[] = [
  {
    term: 'Dots',
    meaning:
      'One dot per project on the ring round the core, in card order clockwise from twelve: blocked first, ringed. A bigger dot has more open work. Point at a dot, or at its card, to see its name; click a dot to go to its card. A dot fades, with a slow grey pulsing ring, once its oldest pull request has sat untouched for a week.',
    section: SKY,
  },
  {
    term: 'Comets',
    meaning:
      'Each comet falling behind the core is one open issue, in its project’s colour. More issues make a heavier rain; closing one takes its comet away.',
    section: SKY,
  },
  {
    term: 'Trails',
    meaning:
      'The faint arcs turning counterclockwise round the core, like a long-exposure photograph of stars circling the pole star. The arcs are the same on every visit; their pace is your day. Today’s Claude Code work, against a usual working day by this time of day, sets it: twice as busy turns twice as fast, between half and four times. With no usage to read they keep a steady once every twenty minutes. Work done since the last refresh spins them up for a moment.',
    section: SKY,
  },
  {
    term: 'Spin',
    meaning:
      'The Spin lever at the foot of the screen scales the trails’ pace: 1× is today’s pace (point at the lever to see how busy today is), 0× holds them still, and they go up to a hundred times faster. Remembered. With Motion off they hold still whatever it says.',
    section: SKY,
  },
  {
    term: 'Progress',
    meaning:
      'When a refresh shows issues closed or pull requests merged since the last one, that project’s dot bursts green, green comets flare into the core, one per thing done, and the star trails spin up for a moment.',
    section: SKY,
  },
  {
    term: 'Ripple',
    meaning:
      'A wave rolls across the floor each time fresh project data arrives, about every five minutes. No ripple for a long while means the data has stopped coming.',
    section: SKY,
  },
  {
    term: 'Fog',
    meaning:
      'Home fogs over as its project data ages: nothing for six hours, full by three days. A line under the core says how old the data is. Fresh data clears it.',
    section: SKY,
  },
  {
    term: 'Mood',
    meaning:
      'The core’s mood follows your projects: calm, slow green when nothing is blocked; quicker, deeper breathing, warming toward amber, as blocked projects and stuck PRs pile up. Grey until the projects are read. The line under CLAUDE says why.',
    section: SKY,
  },
  {
    term: 'Agents',
    meaning:
      'Below Projects (Agents in the menu jumps there): what each agent you use cost over the last 30 days, read from Claude Code’s logs on this machine. pm, refine, ux-design, dev and qa each keep one colour in every chart; every other agent (Explore, general-purpose and the rest) is grey Other. Click a moon, a bar, a day or a grid cell to narrow the charts; the chips above them clear it.',
    section: AGENTS,
  },
  {
    term: 'Orrery',
    meaning:
      'Each agent a moon round a small core, pipeline order from the centre out. A bigger moon did more work; the arc round it is its average peak context against the 200k window. Use it for the morning glance.',
    section: AGENTS,
  },
  {
    term: 'Ranking',
    meaning:
      'Work tokens per agent, most first, with its runs and what a run costs; Table view gives every figure. Use it to see who costs what, or whether a change to an agent lowered its cost a run.',
    section: AGENTS,
  },
  {
    term: 'By day',
    meaning:
      'Work tokens a day for 30 days, stacked by agent. Use it when your usage or weekly limit jumps; click a day to list its runs.',
    section: AGENTS,
  },
  {
    term: 'Context',
    meaning:
      'Each run is a dot at its peak context: the most one request carried (its input and cache), not the run’s total. The white tick is the agent’s median. A run past the dashed 200k line was on a 1M-context model. A crowd to the right means an agent’s tasks are too big to hold.',
    section: AGENTS,
  },
  {
    term: 'Grid',
    meaning:
      'Work tokens per agent and project, brighter for more; an empty cell never ran there. Use it to see where your effort goes; click a cell to narrow the charts to that project and light that agent. Every other project is in the Project list above the charts.',
    section: AGENTS,
  },
  {
    term: 'Runs',
    meaning:
      'The runs behind whatever the charts are narrowed to, newest first: the agent, what it was asked, its project, tokens, peak context, time taken and when it ended. #n is the issue it worked on: the one its task names, or for dev, qa and the rest, the one its branch is named for. pm, refine and ux-design run before a change has a branch, so they count only when their task names the issue.',
    section: AGENTS,
  },
  {
    term: 'Pipeline',
    meaning:
      'On a pull request’s screen and in an issue’s window: each agent run on that change as a bar in time. Gaps are waits between hand-offs; ↻ marks a stage that ran again. Use it when a change took too long or cost too much.',
    section: AGENTS,
  },
  {
    term: 'Routine',
    meaning:
      'A glance at the orrery each morning. On your review day, the Agent review card walks you through By day for the week, then Ranking for which agents cost the most. When something feels off, Context for an agent that seems lost, or the pipeline on the pull request that dragged.',
    section: AGENTS,
  },
  {
    term: 'Review',
    meaning:
      'From 2pm on your review day (Friday unless you choose another), an Agent review card sits above the tools: By day, then Ranking, then Context, each a click away. Done for this week puts it away until next week; Remind me Monday brings it back at 9 on Monday. With Speak on, Home reads it aloud when it appears.',
    section: AGENTS,
  },
  {
    term: 'Nudges',
    meaning:
      'Chips under the status line when the agent runs show something worth a look, at most one of each kind: an agent near or past the 200k window three times this week (opens Context); a busy day, twice your usual work (By day); an agent costing 30% more a run than before (Ranking); a change that ran a stage again (its issue window, with its pipeline); a project where dev ran and qa never did (the grid). The × rests that kind until tomorrow.',
    section: AGENTS,
  },
  {
    term: 'Reminders',
    meaning:
      'Weekly review, above the charts, chooses the day or turns every agent reminder off. Notify me asks the browser once, then sends a notification when the review is due and Home is in the background. Home has to be open for either: the runs are read on this machine, so nothing can remind you from elsewhere.',
    section: AGENTS,
  },
  {
    term: 'Order',
    meaning:
      'Blocked first, then the ones GitHub has not worked out or could not read, then the rest.',
    section: USING,
  },
  {
    term: 'Counts',
    meaning:
      'On your own machine a card can differ for a few minutes from the project’s star map. Refresh brings them level.',
    section: USING,
  },
  {
    term: 'Core',
    meaning:
      'Drag the ball to turn it; flick it and it coasts. The points near your pointer light up. With the core focused, the arrow keys turn it. Click it without dragging (or press Enter) to talk, and again to send, as the mic does; where voice cannot run, it opens the ask box instead.',
    section: USING,
  },
  {
    term: 'Motion',
    meaning:
      'Follows your system’s reduced-motion setting until you press it; then it remembers your choice. Off, everything holds still.',
    section: USING,
  },
  {
    term: 'Sound',
    meaning:
      'A trance track made in this browser as you listen: a steady beat, a rolling bass, a pumping pad and a glassy lead melody over four chords. Pointing at a project plays a short motif from where its dot sits. As projects strain, the beat gets busier and the arpeggio climbs. Off until you turn it on, and remembered.',
    section: USING,
  },
  {
    term: ASK,
    meaning:
      'Type a request and press Enter. Plainly named app actions are matched by keyword; Jev answers the rest, thinking with Claude Code on your own subscription and looking up your projects, usage or the web as it needs, and remembers this visit’s conversation. A web answer lists its sources under it: click one to read it in a floating window you can drag and resize (Ctrl-click opens a tab instead). Each reply says which tier it took and how.',
    section: USING,
  },
  {
    term: 'Arcs',
    meaning:
      'The three arcs round the ball are the tiers. They light in turn while Home works a request out, then the tier the reply took stays lit for a moment.',
    section: USING,
  },
  {
    term: 'Tier 1',
    meaning:
      '●○○ An app action: open a page, refresh, help. Matched without calling any model when you name it plainly.',
    section: USING,
  },
  {
    term: 'Tier 2',
    meaning:
      '●●○ Jev’s answer, from Claude Haiku. It looks up your projects and usage itself, remembers this visit’s conversation, and can be wrong.',
    section: USING,
  },
  {
    term: TIER_3,
    meaning:
      '●●● Work in a project. Home shows the command that runs it as a Claude Code task, for you to run in the project’s folder.',
    section: USING,
  },
  {
    term: 'Talk',
    meaning:
      'Press Tap to talk once to start and again to stop, or hold it and let go to send. With ElevenLabs on, your recording is turned into text by ElevenLabs, on your ElevenLabs credits; otherwise a speech model in this browser does it, and no audio leaves it.',
    section: USING,
  },
  {
    term: 'Speak',
    meaning:
      'Reads actions and Jev’s answers aloud, in this browser. Off until you turn it on, and remembered.',
    section: USING,
  },
];

/** Where the local site can run a task, tier 3 says so, and its lines follow. */
const RUN_HELP_ENTRIES: readonly HelpEntry[] = [
  {
    term: TIER_3,
    meaning:
      '●●● Work in a project. Home shows the task, the project folder it would run in and the command, and runs it as a Claude Code task only when you press Run. When no project is named, it asks which.',
    section: USING,
  },
  {
    term: 'Run',
    meaning:
      'Run arms after a moment, then a click, or Enter or Space on Run itself, starts the task. Nothing else does: not Enter anywhere else, and never your voice. A proposal lasts 5 minutes, and one task runs at a time.',
    section: USING,
  },
  {
    term: 'Task',
    meaning:
      'A running task has a panel on the right: its state, its time against the 30-minute limit, and what Claude Code does as it happens. It runs with your own Claude Code permissions and hooks. Hide folds the panel into the pill at the top; the core shows Working while it runs.',
    section: USING,
  },
  {
    term: 'Tools',
    meaning:
      'Each tool Claude uses is one line: its name and what it was called with, marked ○ while it runs, ✓ once it worked, ✕ if it failed. Press a line to see the call and what came back. Claude’s own words read as plain text between them. The run ends with a green block (the result, the time, the cost and the turns), or a red one if it stopped with an error.',
    section: USING,
  },
  {
    term: 'Refused',
    meaning:
      'An amber Not allowed block, marked ⊘, is a tool Claude wanted that your Claude Code settings don’t allow. It was not done, and Claude carried on without it; the count sits under the title. A dashed Expected block is one of your own hooks asking Claude to write where a run from Home can’t: skipped, and nothing to worry about.',
    section: USING,
  },
  {
    term: 'Hooks',
    meaning:
      'Your own Claude Code hooks run in every task. They fold into one Hooks line; press it for each hook and how it went.',
    section: USING,
  },
  {
    term: 'Recent',
    meaning:
      'Recent runs, under the output, lists the task running now and the last five that finished since the local site started, with their time and cost. Press one to read it again; Back returns to the current run. With no task running, the pill at the top opens them. Reloading the page picks a running task up where this tab left it.',
    section: USING,
  },
  {
    term: 'Cancel',
    meaning:
      'Cancel run stops the task and everything it started, at once. Changes it already made stay made. Esc never cancels a task.',
    section: USING,
  },
];

const MAIL_HELP_ENTRY: HelpEntry = {
  term: 'Mail',
  meaning:
    'In the left column, under System vitals (Mail in the menu jumps there): the 20 newest messages in your iCloud and Gmail inboxes, one tab each, newest first. New marks unread mail; Home only reads, and never marks anything read. Refresh reads both again. New unread mail also shows as a notice on any page, and with Speak on Jev says it: only how many with ElevenLabs, the sender and subject with Kokoro. The settings go in ~/.claude/observatory/.env (the README says how to make an app password). Only on this machine.',
  section: USING,
};

/** `entries` with Mail, just before Ask, for a site that has mail. */
export function withMailHelp(entries: readonly HelpEntry[]): readonly HelpEntry[] {
  const ask = entries.findIndex((entry) => entry.term === ASK);
  return [...entries.slice(0, ask), MAIL_HELP_ENTRY, ...entries.slice(ask)];
}

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
  { key: 'F8', action: 'go to the notifications' },
];
