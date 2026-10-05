/* pr-starmap's help, one card per screen and view, word for word. */

/** A help card: what the screen is, then what each mark means. */
export interface HelpScreen {
  readonly title: string;
  readonly rows: readonly (readonly [string, string])[];
}

export type HelpKey =
  'prs-map' | 'prs-list' | 'issues-map' | 'issues-list' | 'usage-list' | 'logs-map' | 'logs-list';

export const HELP: Readonly<Record<HelpKey, HelpScreen>> = {
  'prs-map': {
    title: 'Review Queue',
    rows: [
      ['Star', 'One open pull request.'],
      ['Colour', 'Why it is stuck. Click a colour at the top to show only that kind.'],
      ['Size', 'How long it has waited untouched.'],
      ['Ring', 'Blocked: it cannot merge, or its checks fail.'],
      [
        'Kind',
        'Zoom in to see what each star is. Blocked ones are deep giants that throw flares, more often the longer they wait; one GitHub has not settled hides in a veil of gas; work waiting on you burns clear, with spikes; one you saw recently rests, small and calm.',
      ],
      ['Lines', 'Silver lines join the pull requests in a group, in the order to work them.'],
      ['Thread', 'The dotted silver line runs through the groups in the order to work them.'],
      [
        'Changes',
        'What changed since you last looked. A shockwave marks a pull request that became blocked, a white flash a new one, falling green rings one that was unblocked; merged and closed ones cross the sky as shooting stars. The panel lists them; Got it clears the marks.',
      ],
      [
        'Collide',
        'Red threads join pull requests that would conflict with each other: git merged each pair and failed. A spark marks the middle; thicker means more files. Click a star to see its threads, including files it shares without conflict. Collisions hides them.',
      ],
      [
        'Mass',
        'The tilted disc around a star is its review cost: it reaches further and weighs more the more lines the change touches. Under twenty lines there is none.',
      ],
      [
        'Quick',
        'Quick wins are unblocked, linked to an issue and under 200 lines — mergeable in minutes. Click quick wins at the top to light only those.',
      ],
      [
        'Comet',
        'A comet is an open issue no pull request closes — work nobody has picked up. Its head grows with age, its tail with how long it has sat untouched. Click one, then Open to read the issue. The legend entry shows or hides them.',
      ],
      [
        'Binary',
        'Two stars joined by a twisted pair of strands close the same issue — usually the same work done twice. Merge one; the other will close nothing.',
      ],
      [
        'Agents',
        'Agents opens a report card per agent: how many of its pull requests merged, are still open, conflict, or close no issue, and how long a merge takes. Each says whether its attribution is named, inferred or missing. Click a card to light only that agent’s stars.',
      ],
      [
        'Plan',
        'Merge plan numbers the stars in the order that needs the fewest rebases and lights the path through them; the list says what each merge will force to rebase. Stacked branches follow their base, and branches that already conflict go last.',
      ],
      [
        'Fog',
        'Fog means what you see may be out of date. The sky fogs over as its data ages: clear for six hours, full by three days. If refreshing fails, it fogs at once, thinly, and thickens to full an hour after the last good read, so a broken feed never passes for a quiet one. Issues, Usage and Logs each fog by the age of their own data. The badge by the title says how old it is; Refresh clears it.',
      ],
      [
        'Timeline',
        'The strip at the bottom: open pull requests per day for 60 days, each merge a green streak, each recorded refresh a tick. Drag across it, or press Replay, to watch the sky change refresh by refresh; [ and ] step, Live returns to now.',
      ],
      [
        'Click',
        'A card with the essentials, plus Snooze and Dismiss. Open shows the whole pull request: description, files, commits, checks and diff. Issue #n reads its issue here.',
      ],
      [
        'Edit',
        'The Edit tab changes the title, description, labels, assignees and reviewers. Save sends them to GitHub; a badge says how it went.',
      ],
      [
        'Decide',
        'Merge and Ready for review are yours alone. Type the PR number to merge. A merge refuses if commits arrived after you looked, or if the branch conflicts.',
      ],
      [
        'Fetch',
        'A pull request opened since the last refresh shows Request fetch; Refresh re-fetches one that is out of date. The open screen fills in by itself.',
      ],
      [
        'Pipeline',
        'Under a pull request’s description, when agents worked on it: each run on its branch or for its issue as a bar in time, with the tokens it spent. Gaps are waits between hand-offs; ↻ marks a stage that ran again.',
      ],
      [
        'Drag',
        'Cards and the pull-request screen move by their headers. Double-click a header to put it back.',
      ],
      [
        'Sound',
        'Ambient score, off until you press Sound; the slider beside it sets the volume. An off-key tone grows with the number of blocked pull requests, and settles as you clear them. Clicking a star plays a note, lower when it is stuck.',
      ],
      ['Move', 'Drag the sky to pan, scroll to zoom, Fit to see everything.'],
    ],
  },
  'prs-list': {
    title: 'Review Queue — list',
    rows: [
      ['Rows', 'Every open pull request, most urgent group first.'],
      ['Order', 'Within a group, the one waiting longest comes first.'],
      ['Filter', 'Click a colour at the top to show only that kind.'],
      ['Click', 'Jumps to that pull request on the star map.'],
    ],
  },
  'issues-map': {
    title: 'Issues — nursery',
    rows: [
      [
        'Disk',
        'Every issue on the tab, as a spiral disk round the project’s core. Starmap / List switch between this and the rows.',
      ],
      [
        'Arm',
        'The most-used labels each get an arm in their colour; the rest share a grey one. Unlabelled issues drift in a halo.',
      ],
      [
        'Radius',
        'How long an issue has sat untouched. Fresh work sits near the warm core; the rim is the backlog nobody touches.',
      ],
      [
        'Globule',
        'A dark ball of gas with a pale rim: open, and no pull request closes it. Nobody is on it. Bigger means older.',
      ],
      [
        'Protostar',
        'A lit core: an open pull request closes it. One jet per open pull request, labelled with its number; amber jets mean two or more, likely the same work twice.',
      ],
      ['Moon', 'A small dot circling an issue: one per assignee.'],
      [
        'Settled',
        'On the Closed tab, a pale star: closed as done. It sinks toward the core and dims as it ages out of the 60 days.',
      ],
      [
        'Dust',
        'On the Closed tab, a faint scatter: closed as not planned, as a duplicate, or with no reason recorded. Only work closed as done becomes a star.',
      ],
      [
        'Filter',
        'Tabs, label and search work here too; what does not match dims. Picking a label lights its arm.',
      ],
      [
        'Click',
        'Hover for the number and title. Click for a card: labels, assignees and the pull requests on it. Open reads the issue here; GitHub ↗ opens it there.',
      ],
    ],
  },
  'issues-list': {
    title: 'Issues',
    rows: [
      ['Toggle', 'Starmap / List switch to the nursery sky of the same issues, and back.'],
      [
        'Rows',
        'Every open issue, and the ones closed in the last 60 days. Click a title to read it here; Ctrl-click opens it on GitHub.',
      ],
      [
        'Window',
        'The issue’s labels, people and description. Drag it by its top bar; Esc closes it. A description not fetched yet shows Request fetch.',
      ],
      [
        'Pipeline',
        'Under the issue’s description, when agents worked on it: each run for it as a bar in time, with the tokens it spent. Gaps are waits between hand-offs; ↻ marks a stage that ran again.',
      ],
      ['Tabs', 'Open lists the most recently touched first; Closed, the most recently closed.'],
      ['Label', 'Show only the issues with one label.'],
      ['Search', 'Matches titles as you type; #12 finds issue 12.'],
      [
        'PR',
        'The pull requests that close it. An open one opens its screen here; a merged or closed one opens on GitHub.',
      ],
      [
        'Comet',
        'An open issue no open pull request closes: nobody is on it. The count at the top shows only those.',
      ],
    ],
  },
  'usage-list': {
    title: 'Usage',
    rows: [
      [
        'Week',
        'How much of your weekly Claude Code limit is used: the number /usage shows. Read by the local site while it runs, or recorded by your status line; the panel says how when there are none.',
      ],
      [
        'Pace',
        'Where the week will stand at its reset if the last two days’ pace holds. A warning says when it would run out first.',
      ],
      [
        'Chart',
        'This week, reading by reading. The dashed line is the pace; the dotted one is now. A gap is time nothing was read.',
      ],
      ['5-hour', 'The current five-hour window, and when it resets.'],
      ['Unknown', 'A dash means the window reset and nothing has been read since. It is not zero.'],
      [
        'Tokens',
        'Tokens per day from your session logs, by model: input, output and cache writes. Cache reads are counted apart; they cost far less.',
      ],
      [
        'Project',
        'Tokens per project; this page’s project is lit, with pull requests merged over the same days.',
      ],
      ['Hover', 'Any bar or point shows its numbers.'],
    ],
  },
  'logs-map': {
    title: 'Log Sky',
    rows: [
      ['Group', 'One app window. Its name and line count sit underneath.'],
      ['Star', 'One distinct error (red) or warning (amber).'],
      ['Filter', 'Click errors or warnings at the top to show only those.'],
      ['Size', 'How many times it happened.'],
      ['Ring', 'Still happening: seen in the last 3 days of logs.'],
      [
        'Click',
        'The message, copy it or find it in the code, and threads to the same fault in other windows. The threads stay when you close the card; click empty sky to clear them.',
      ],
      [
        'Strip',
        'Errors and warnings per day. Hover a day for its counts; a clicked star shades its lifetime.',
      ],
      ['Sound', 'The same ambient score. Here the off-key tone follows the faults still burning.'],
    ],
  },
  'logs-list': {
    title: 'Log Sky — list',
    rows: [
      ['Rows', 'Every error and warning, grouped by window, worst window first.'],
      ['×n', 'How many times that message was logged.'],
      ['Filter', 'Click errors or warnings at the top to show only those.'],
      ['Click', 'Jumps to its star on the Log Sky.'],
    ],
  },
};
