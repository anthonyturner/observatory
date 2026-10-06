/* pr-starmap's help, one card per screen and view, word for word. */

/** A help card: what the screen is, then what each mark means. */
export interface HelpScreen {
  readonly title: string;
  readonly rows: readonly (readonly [string, string])[];
}

export type HelpKey =
  | 'prs-map'
  | 'prs-list'
  | 'issues-map'
  | 'issues-list'
  | 'usage-list'
  | 'retro-list'
  | 'logs-map'
  | 'logs-list';

export const HELP: Readonly<Record<HelpKey, HelpScreen>> = {
  'prs-map': {
    title: 'Review Queue',
    rows: [
      ['Star', 'One open pull request.'],
      ['Colour', 'Why it is stuck. Click a colour at the top to show only that kind.'],
      ['Size', 'How long it has waited untouched.'],
      [
        'Black hole',
        'The black hole at the centre pulls in pull requests left idle too long: 14 days, unless you change hole in the tools. The longer past that, the further a star spirals in, its light reddening and stretching toward the hole, though its colour still shows its group. None falls all the way in. Its card says Falling in. A commit or review, the end of a snooze, or a merge resets the count, and the star moves back out on the next refresh.',
      ],
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
        'The tilted disc of gas around a star is its review cost: it reaches further and glows heavier the more lines the change touches. Under twenty lines there is none.',
      ],
      [
        'Planets',
        'Zoom in to see a small planet orbiting a star for each issue its pull request closes, up to four. A star with none closes no issue.',
      ],
      [
        'Done',
        'The spiral galaxy is what you finished in the last 60 days, newest at its arm tips, older winding in to the core: blue-white for a merged pull request, an ember for one closed unmerged, gold for a closed issue, grey for one dropped. Rest the pointer on a light for what it was; click it to open it. Done lists them by day; press merged, closed, issue done or dropped there to show only that kind. The search box finds them too.',
      ],
      [
        'Quick',
        'Quick wins are unblocked, linked to an issue and under 200 lines — mergeable in minutes. Click quick wins at the top to light only those.',
      ],
      [
        'Comet',
        'A comet is an open issue no pull request closes — work nobody has picked up. Its head grows with age, its tail with how long it has sat untouched. Rest the pointer on one for its card; click it to read the issue. The legend entry shows or hides them.',
      ],
      [
        'Binary',
        'Two stars joined by a twisted pair of strands close the same issue — usually the same work done twice. Merge one; the other will close nothing.',
      ],
      [
        'Chain',
        'A silver chain joins a stacked pull request to the one it is built on, the pull request whose branch it merges into; a glint runs along it toward that base. When the base merges, its children are left holding a broken gold chain marked BASE MERGED · UPDATE: open one and Send crew to update it, merging in the work where the base landed and pointing the pull request there.',
      ],
      [
        'Agents',
        'Agents opens a report card per agent: how many of its pull requests merged, are still open, conflict, or close no issue, and how long a merge takes. Each says whether its attribution is named, inferred or missing. Click a card to light only that agent’s stars.',
      ],
      [
        'Crew',
        'On your own machine, the card and screen of a conflicted or failing pull request, or of one whose stacked base has merged, offer Send crew: a Claude Code task merges the base into a conflicted branch, fixes failing checks, or updates a branch whose base merged, and pushes to the pull request’s branch. It never merges the pull request. A small ship circles the star while the crew works (parked beside it when motion is off), then flies off, leaving a green tick or a red cross. One task runs at a time; the card shows how the crew stands and links to its log on Home.',
      ],
      [
        'Plan',
        'Merge plan numbers the stars in the order that needs the fewest rebases and lights the path through them; the list says what each merge will force to rebase. Stacked branches follow their base, and branches that already conflict go last.',
      ],
      [
        'Next star',
        'Next star, or the n key, flies to the one pull request to work next and opens it: from the most blocked group, the merge plan’s first step when it is there, else the one idle longest, with a quick win breaking a tie. Drafts, snoozed and dismissed ones are skipped. Rest the pointer on the button to see which it will open, and why.',
      ],
      [
        'Sprint',
        'Sprint time-boxes a review: pick 15, 25 or 45 minutes and the queue fills it, in queue order with Next star’s pick first, with pull requests whose size fits. Each is budgeted 2 minutes plus 500 changed lines an hour; one too big for the time left is passed over, and drafts and ones of unknown size are left out. Its stars stay lit and the rest dim, a timer runs, and Next star works through it. Opening a pull request counts it as reviewed. End it early or let the time run out for a summary of what merged, what you reviewed and what was skipped.',
      ],
      [
        'WIP limit',
        'More than 8 open pull requests, drafts aside, is more work in progress than finishes well: past that the comets fade and a note under the search suggests finishing one before starting another. Nothing is blocked; the comets still open. Set the number with wip in the tools; get back within it and the comets brighten again.',
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
        'Hover',
        'Rest the pointer on a star for its card: the essentials, plus Snooze and Dismiss. A low, medium or high risk tag says how careful a review it needs, from the files it changes (auth, migrations, config, CI, dependencies, or a broad change); with an OpenRouter key on your own machine, a one-line summary says what it does. It stays until you rest on another star or click empty sky. Issue #n reads its issue here. On a touch screen, tap once for the card.',
      ],
      [
        'Click',
        'Opens the whole pull request: description, files, commits, checks and diff. The card’s Open does the same. On a touch screen, tap the star a second time.',
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
      [
        'Stack',
        'A row built on another pull request says which, and which are built on it. Base merged · update it means the one it was built on has merged: open it to send a crew.',
      ],
      [
        'WIP limit',
        'Past the limit set with wip in the tools (8 open pull requests, drafts aside, unless you change it), a note under the search suggests finishing one before starting another.',
      ],
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
  'retro-list': {
    title: 'Weekly retro',
    rows: [
      ['Week', 'The seven days up to when the queue was last read from GitHub.'],
      [
        'Waited',
        'How long the pull requests merged or closed this week spent in each state: cannot merge, checks failing, mergeability unknown, no issue linked, or waiting on you. GitHub keeps no history of these, so it comes from the queue’s own refreshes: a state counts from the refresh that saw it to the next one, or until the pull request finished. The note says how many it saw.',
      ],
      [
        'Cycle',
        'The median time from opened to merged, for each of the last eight weeks. A dash is a week where nothing merged.',
      ],
      [
        'Agents',
        'Merges this week by the agent that opened each pull request, as the Agents report cards attribute them; work with no recorded handoff has its own row.',
      ],
      ['Hover', 'Any bar shows its numbers.'],
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
