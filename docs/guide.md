# Observatory guide

Welcome! Observatory draws your GitHub work as a night sky: projects are
worlds, pull requests are stars, issues are comets, and finished work becomes
the glow of a galaxy. This guide walks through every screen and says what each
thing you see means, what you can do with it, and who gets to see it.

In Observatory, open it from the **Guide** link on any screen, which brings
you straight to that screen's part. The filter box finds a word anywhere in
the guide, and the contents jump to any part.

## Start here

### Reading the sky

Every mark in Observatory is one of two things:

- **Data.** It changes with your work: a colour, a size, a ring, a light. The
  guide says what each one stands for.
- **Scenery.** It is there to look good and means nothing: the kind of planet,
  its land and clouds, the shimmer on a star. Scenery is chosen per project,
  so a project looks the same every time you visit.

A few things work the same on every screen:

- **Motion.** Follows your computer's reduced-motion setting until you press
  it, then remembers your choice. With motion off, everything holds still and
  the meaning stays: a flare becomes a glow, a streak becomes a glint.
- **Sound.** Off until you turn it on. Space is mostly silent: sounds come only
  from things that happen, such as a merge or a meteor landing.
- **Fog.** When data gets old, the sky fogs over: clear for six hours, full by
  three days. If reading GitHub fails, a thin fog arrives at once and thickens,
  so a broken feed never looks like a quiet day. Refresh clears it.
- **List views.** Most skies have a **List** button that shows the same things
  as plain rows, which is handy for a screen reader or a quick scan.
- **Flat fallback.** Where your browser can't draw in 3D, the skies switch to a
  simpler flat drawing with the same meaning.

### Who sees what

Observatory runs in two places: on your own computer, and as a hosted site you
can open from anywhere. The hosted site can also have a **public preview**, a
read-only view for visitors who aren't you.

| Part                                                         | Your own computer | Hosted, signed in as you | Preview visitor                 |
| ------------------------------------------------------------ | ----------------- | ------------------------ | ------------------------------- |
| Home, the Orrery, the Review Queue                           | Yes               | Yes                      | Public projects only, read-only |
| Releases, Actions, Journal, Library, Deployments, Milestones | Yes               | Yes                      | Public projects only            |
| Security                                                     | Yes               | Yes                      | Counts only, no alert details   |
| Insights                                                     | Yes               | Yes                      | Everything but traffic          |
| Depth, Architecture                                          | Yes               | No                       | No                              |
| Inbox                                                        | Yes               | Yes                      | No                              |
| Jev, voice, mail, skills and tasks                           | Yes               | No                       | No                              |
| Agents, crews, satellites                                    | Yes               | No                       | No                              |
| Usage and triage                                             | Yes               | Yes                      | No                              |

A preview visitor can look but never change anything: no snoozing, no merging,
no edits, no reruns. A private project stays hidden from them, name and all,
unless you choose to show private projects too.

### Getting around

- **Guide.** Every screen has a Guide link beside its way back, and Home has
  one in its top bar. It opens the part of this guide for that screen.
- **The way back.** The small pill above each screen's title takes you up a
  level: to Home, or to **All projects** (the Orrery).
- **Project tabs.** Each project's screens share one row of tabs: Queue,
  Releases, Actions, Journal, Library, Depth, Architecture, Security, Insights,
  Deployments and Milestones. A tab can carry a count (Security shows open alerts), and a
  tab with nothing in it for this project fades back, dimmed and in italics.
- **Help card.** Press **?** on Home, the Orrery or the Review Queue for a
  short card about that screen. Each card links here for the longer story.
- **Keys.** **Esc** closes things, **F8** jumps to the notices, and the arrow
  keys move or pan where there is something to move.

## Home

### The core

The glowing ball in the middle of Home is Observatory's heart. It shows how
your projects are doing and what Jev, your assistant, is up to.

What it means:

- **Mood.** Calm and slow green when nothing is blocked. As blocked projects
  and stuck pull requests pile up, it breathes quicker and deeper and warms
  toward amber. It stays grey until your projects have been read. The line
  under it says why it feels the way it does.
- **Dots.** One dot per project on the ring around the core, in the same order
  as the project cards, starting at twelve o'clock: blocked projects first,
  ringed. A bigger dot has more open work. A dot fades, with a slow grey
  pulsing ring, once its oldest pull request has sat untouched for a week.
- **Three arcs.** These are Jev's three tiers (see [Jev](#jev)). They light in
  turn while he works a request out, and the tier he used stays lit for a
  moment.
- **Voice ring.** Swells as you speak to Jev.
- **State chips.** Say whether Jev is idle, listening, working or speaking.

What you can do: drag the core to turn it (flick it and it coasts), or use the
arrow keys once it has focus. Points near your pointer light up. Click a dot to
jump to its project's card. Click the core itself, or press Enter on it, to
start talking to Jev, and again to send.

### The sky over Home

- **Comets** falling behind the core are open issues, one each, in their
  project's colour. More issues, heavier rain; closing one takes its comet away.
- **Star trails** are the faint arcs turning around the core, like a
  long-exposure photo of the night sky. Their speed is your day: today's
  Claude Code work compared with a usual day by this hour. Twice as busy turns
  twice as fast. The **Spin** lever at the foot of the screen scales it, from
  still to a hundred times faster.
- **Progress.** When a refresh finds issues closed or pull requests merged,
  that project's dot bursts green, green comets flare into the core (one per
  thing done), and the trails spin up for a moment.
- **Ripple.** A wave rolls across the floor each time fresh data arrives, about
  every five minutes. No ripple for a long while means the data has stopped.
- **Fog.** Home fogs over as its data ages, and a line under the core says how
  old it is.
- **Music sky.** While the playlist plays, the sky moves with the music (see
  [Playlist](#playlist) and [Sync](#sync)).

The tools along the foot hold **Refresh** (read every project from GitHub
now), **Spin**, **Motion**, **Sound** and **?** for help. Home's own Sound plays
a trance track made live in your browser that grows busier as projects strain;
pointing at a project plays its little motif.

### Projects and vitals

**Project cards** sit under the core, blocked first. Each card shows:

- What kind of trouble it has (Blocked, Unsettled, Untracked work, Waiting or
  Clear) and a bar for each kind of open pull request: cannot merge, checks
  failing, mergeability unknown, no issue linked, waiting on you, plus
  unclaimed issues.
- Links to the project's PRs, Issues, Logs and Usage, an **Actions** link whose
  dot says whether its main branch's checks are passing, failing or running,
  and a GitHub link.
- "Counts unknown, not zero" when GitHub couldn't be read for it.

The **Notify me** box in the Projects heading sends a desktop notification
when a pull request merges or an issue opens while Observatory is in the
background.

**System vitals**, in the left column, holds your Claude Code usage (tokens
today, the 5-hour window and the weekly limit), **Directives** (the three most
blocked pull requests across your projects) and **Documents** links.

The top bar jumps to Home's sections (Mail, News, Projects, Agents) and links
to the Agents screen (with how many sessions are running), the Inbox (with
your unread count), the Orrery and this Guide.

### Jev

Jev is Observatory's assistant. Type in the **Ask** box (press **/** to get
there) or talk to him, and he answers in plain words.

Every request takes one of three tiers, shown on the core's arcs:

- **●○○ Tier 1, an app action.** "Open the orrery", "refresh", "help". Matched
  instantly by keyword, with no AI at all.
- **●●○ Tier 2, Jev's answer.** He looks up your projects, pull requests,
  issues, usage or the web as he needs, and remembers this visit's
  conversation. A web answer lists its sources, which open in a floating
  reader you can drag and resize. **New conversation** makes him forget.
- **●●● Tier 3, work in a project.** Jev proposes a Claude Code task. Nothing
  runs until you press Run (see [Running tasks](#running-tasks)).

Jev also works the Review Queue for you: "what's blocking?" reads out the top
three pull requests, "next star" opens the one to work next, "snooze 412 till
Monday", "dismiss 412" and "send a crew to 412" do just that. Anything that
changes something asks yes or no first, aloud and with buttons. He understands
these said loosely too ("um, park the login fix till next Monday").

Jev never changes code, runs commands or touches GitHub himself. Work is only
ever proposed.

**Only on your own computer.** On the hosted site Home shows one line in place
of Ask, voice and skills.

### Talking to Jev

- **Talk.** Press **Tap to talk** once to start and again to stop, or hold it
  and let go to send. Clicking the core does the same.
- **Speak.** Turn on Speak and Jev reads his answers aloud.
- **Voice.** Under Speak, pick an ElevenLabs voice or Kokoro, a voice that
  runs right in your browser. If ElevenLabs can't speak, Kokoro takes over and
  the status line says why.
- **Hearing.** Your words are turned into text by ElevenLabs when it is on, or
  by a speech model in your browser, in which case no audio leaves it.
- **Open questions.** After a list ("what's blocking?") or spoken news, Jev may
  ask "Would you like to open any of them?". Answer by number, by place ("the
  first one"), or by words from the title.
- **Taking turns.** If you use Agent Speak on the same computer, Jev and your
  coding agents never talk over each other.

### Running tasks

When Jev proposes work in a project, the proposal shows the task, the folder it
would run in and a **Run** button.

- **Run** arms after a moment. Only a click, or Enter or Space on Run itself,
  starts it, never your voice. A proposal lasts five minutes.
- **The task panel** shows each tool Claude uses as one line (○ running,
  ✓ worked, ✕ failed), Claude's own words between them, and a green or red
  block when it finishes with the time, cost and turns.
- **Not allowed** (amber, ⊘) marks a tool your Claude Code settings refused.
  **Hooks** fold into one line you can open.
- **Recent runs** lists the last few tasks; press one to read it again.
- **Cancel run** stops the task at once; changes it already made stay.

One task runs at a time, for at most 30 minutes, with your own Claude Code
permissions. A pill at the top shows a task is running and opens it again.

**Only on your own computer.** Elsewhere a proposal shows the command to copy.

### Skills and today's principle

**Skills** are one-press requests, a tile each, such as triaging the review
queue or listing today's failures. One press proposes the work; you confirm it.

The **Principle of the day**, under the skills, is one of John Ousterhout's
software-design ideas, what it means, and a question to ask yourself today. It
stays the same all day; **Previous** and **Next** step through the rest and
**Today's** comes back. Ask Jev "what's today's principle?" to hear it.

### News and mail

**News** lists the latest AI news (new tools for building software first,
marked _tool_) and software engineering stories from public feeds, with a
paragraph or two each. Click a headline to read it in the floating reader;
Ctrl-click opens a tab instead.

**Mail**, under System vitals, lists the 20 newest messages in your iCloud and
Gmail inboxes, one tab each, with **New** on unread mail. It only reads: nothing
is ever marked read. **Only on your own computer.**

### Agent costs

Home's **Agents** section shows what each coding agent you use cost over the
last 30 days, read from Claude Code's logs.

- **Orrery.** Each agent is a moon around a small core. A bigger moon did more
  work; the arc around it is its average peak context against the 200k window.
- **Ranking.** Work tokens per agent, most first, with runs and cost per run.
- **By day.** Tokens a day, stacked by agent. Click a day to list its runs.
- **Context.** Each run is a dot at its peak context; past the dashed line was
  a 1M-context model. A crowd to the right means tasks too big to hold.
- **Grid.** Tokens per agent and project. Click a cell to narrow the charts.
- **Runs.** The runs behind whatever you narrowed to, newest first.
- **Agent review.** From 2pm on your review day (Friday unless you pick
  another) a card walks you through the week. **Nudges** under the status line
  point at anything worth a look.

**Only on your own computer.**

## Everywhere

### Notices

A notice slides in at the top right of any page when a pull request merges,
opens, or an issue opens or closes in a project you follow. Several at once are
grouped. **F8** reaches them and **Esc** dismisses one.

- Tick **Notify me** in Home's Projects heading for a desktop notification as
  well while Observatory is in the background.
- With Speak on, Jev says each notice's news aloud once he's free.
- On your own computer, new unread mail shows as a notice too.

### Usage strip

A slim strip at the top centre of every page shows your Claude Code limits: the
5-hour window and the weekly limit as percents with small meters, turning
amber from 80%, and when the nearer one resets. A dash means the window reset
and nothing has been read since; it is not zero. The arrow folds it to a small
chip. It hides when there is no usage to read, and preview visitors never see
it.

### Playlist

The playlist bar sits at the foot of the screen and keeps playing as you move
between pages.

- **Station** tunes to Music (trance and techno), AI, Git & GitHub or Learn,
  each a shuffled list of hand-picked tracks or talks.
- **♥** saves a track to your favourites; press it again to go back to the
  station. Export your favourites to a file and import them elsewhere.
- **Seek** by dragging, or skip back 15 seconds and forward 30.
- **The video window** has **Bigger** and **Smaller** buttons.
- **Video** plays the track full screen behind Home, or behind the Review
  Queue's stars, dimmed so the sky stays readable.
- **Visual** picks a Milkdrop visual for Home's music sky, or Auto to let it
  change every few minutes. **Sky** sets how strongly it shows, and **Beat**
  how hard each beat hits.
- The toggle at the end folds the bar down small. On a phone it starts folded.

When a new song starts, its title fades into Home's sky above the core. On each
beat the core throws a ring, flashes and the edges glow.

### Sync

**Sync**, on Home's playlist bar, makes the sky move with real sound. Nothing
is simulated, and nothing is recorded or sent. The arrow beside it picks what
it listens to:

- **This tab.** The playlist playing in Observatory (Chrome and Edge).
- **Whole computer.** Everything your computer plays (Chrome and Edge on
  Windows and ChromeOS).
- **Input device.** An audio input you pick by name, in any desktop browser.
  A loopback input carries the computer's own sound; a microphone hears the
  room.
- **Sound card.** Everything your Windows PC plays, with no prompt at all.
  **Only on your own computer.**
- **Microphone.** On a phone, Sync listens through the microphone, so play the
  music out loud. It opens only when you press Sync.

## Orrery

The Orrery is a solar system of your projects: one world for each project you
own, orbiting a sun that shows how many pull requests are open.

### Worlds

- **Air colour** is the project's most urgent state: red when something is
  blocked (cannot merge or checks failing), violet while GitHub is still
  working out whether something merges, amber for work with no issue linked,
  blue when pull requests are waiting on you, green when all is clear, and grey
  when GitHub couldn't be read.
- **Size.** A bigger world has more open work.
- **Kind** (rocky with oceans, a banded gas giant, ice or a cratered desert),
  its land and its clouds are scenery.

### Night side

Turn your eye to the dark side of each world:

- **City lights** are work in motion: more open pull requests, more lights,
  dimming as the oldest one goes stale. No open pull requests, no lights.
- **Glowing fissures** appear only while checks are failing, brighter for each
  more failing check. On a gas giant they smoulder in the bands.

### Orbits, moons, rings and comets

- **Orbit.** The most urgent worlds sit innermost. Distance is neglect: a world
  moves out a step for each day its oldest pull request has sat untouched, up
  to ten weeks. Outer worlds come round more slowly.
- **Moons.** One moon per blocked pull request, up to six.
- **Ring.** Thin see-through bands mean branches that no longer merge.
- **Comets** trailing a world are its unclaimed issues.

### Milky Way

The band of the Milky Way across the sky is made of what you shipped: every
pull request merged in the last 60 days is a speck in its project's colour,
oldest at one end of the band and newest at the other. Rest the pointer on one
to see what it was; click it to open that project's Review Queue.

### Using the Orrery

- Point at a world for its card: its counts, a link to its Review Queue, and
  **Show on Home**. Click the world to open its Review Queue. On a touch screen,
  tap once for the card and again to open.
- Drag or use the arrow keys to move, scroll or **+ −** to zoom.
- **Sound** makes the system play itself: each world is an instrument, harsh
  when blocked and a bell when clear, and the sun keeps the beat.

## Review Queue

Each project's Review Queue is a star map of its open pull requests, grouped by
what is holding each one up. Reach it from an Orrery world, a project card, or
the **Queue** tab. Behind it all turns a spiral galaxy made of your finished
work.

### Stars

Each star is one open pull request.

- **Colour** is why it is stuck: cannot merge, checks failing, mergeability
  unknown, no issue linked, waiting on you, or seen recently. Click a colour in
  the legend at the top to show only that kind.
- **Size** is how long it has waited untouched.
- **Kind**, as you zoom in:
  - a **deep giant throwing flares** is blocked, flaring more the longer it
    waits;
  - a star **hidden in a veil of gas** is one GitHub hasn't settled yet;
  - a **clear star with spikes** is waiting on you;
  - a **small, calm star** is one you looked at recently.
- **Pulse ring.** A blocked pull request has a ring around it.
- **Silver lines** join a group's pull requests in the order to work them, and
  a dotted thread runs through the groups in order.
- **Quick wins** are unblocked, linked to an issue and under 200 lines. Click
  quick wins at the top to light only those.

### Around a star

Zoom in and each star shows more:

- **Gas disc.** The tilted disc of glowing gas is review cost: wider and
  brighter the more lines change, green for a quick win, none under twenty
  lines.
- **Planets.** One small planet for each issue the pull request closes, up to
  four. No planets, no linked issue.
- **Weather.** Grey cloud and debris swirling round a star are design red flags
  in the lines it adds: a catch that throws the error away, a method that only
  passes a call along, a check switched off, a to-do with no issue. A thin haze
  for one small flag, a storm with lightning for many. Its card lists each
  flag. Preview visitors see no weather for private projects.
- **Meteor.** A meteor streaks in and lands on a star whose pull request has
  new commits since you last looked. More commits, a brighter, longer streak.
- **Chain.** A silver chain joins a stacked pull request to the one it is built
  on. When that base merges, a broken gold chain marked _base merged · update_
  stays, and the card offers to send a crew to update it.
- **Crew ship.** A small astronaut ship circles a star while a crew works on
  it, then flies off leaving a green tick or a red cross.
- **Satellites.** Each Claude Code agent working in this project orbits as a
  small satellite with a blinking light: quick green while working, amber while
  waiting for you, slow grey when quiet. Hover one for its name.

Crews and satellites are **only on your own computer**.

### The black hole

A black hole sits at the centre of the map and pulls in neglected work. A pull
request left idle past a threshold (14 days, changed with **hole** in the
tools) spirals slowly toward it, further the longer it waits, its light
reddening and stretching toward the hole. None falls all the way in. A commit,
a review, a snooze ending or a merge resets the count, and the star drifts back
out on the next refresh.

### Spiral of Done

The spiral galaxy behind the stars is everything you finished in the last 60
days, newest at the tips of its arms and older work winding in to the core:

- **blue-white** for a merged pull request,
- **ember** for one closed without merging,
- **gold** for a closed issue,
- **grey** for an issue dropped as not planned.

Rest the pointer on a light to see what it was; click it to open it. **Done**
in the tools lists the same work by day, and its buttons show only one kind.
The search box finds finished work too.

### Comets and binaries

- **Comet.** An open issue no pull request closes: work nobody has picked up.
  Its head grows with age, its tail with how long it has sat untouched. Click
  one to read the issue. Every window names what it holds first, **Issue** or
  **Pull request**, before its state, because the colours alone can look alike.
- **Fading comets.** Past a work-in-progress limit (8 open pull requests,
  drafts aside, changed with **wip** in the tools), the comets fade and a note
  suggests finishing something before starting more. Nothing is blocked.
- **Binary stars.** Two stars joined by a twisted pair of strands close the
  same issue: usually the same work done twice.

### Changes and timeline

The Review Queue remembers each refresh and shows what changed since you last
looked:

- a **shockwave** for a pull request that became blocked,
- a **white flash** for a new one,
- **falling green rings** for one that got unblocked,
- a **shooting star** for one closed,
- a **supernova**, a white-gold flash and a ring of dust, for one merged, with
  a deep boom when sound is on.

The changes panel lists them, and **Got it** clears the marks. The **timeline**
along the bottom shows open pull requests per day for 60 days; drag across it
or press **Replay** to watch the sky change, **[** and **]** to step, and
**Live** to come back.

### Collisions and the merge plan

- **Collisions.** Red threads join pull requests that would conflict with each
  other if both merged. Thicker means more files. On your own computer this is
  checked for real against a local copy; elsewhere the pairs are only guesses
  from shared files, and say so.
- **Merge plan** numbers the stars in the order that needs the fewest rebases
  and lights a path through them.

### Working the queue

- **Hover** a star for its card: the essentials, a low, medium or high **risk**
  tag (from what it touches, such as auth, migrations or CI), and **Snooze**
  and **Dismiss**. Click it, or **Open**, for the full pull request.
- **Next star** (or **n**) flies to the one pull request to work next and opens
  it: the most blocked first, then the one idle longest.
- **Sprint** time-boxes a review: pick 15, 25 or 45 minutes and the queue fills
  it with pull requests that fit. A timer counts down, and you get a summary at
  the end.
- **Search** finds a pull request or issue by title or number.
- **Triage.** Mark a pull request seen, snooze it, or dismiss it until it
  changes. Triage stays in Observatory; nothing is written to GitHub.
- **Send crew.** On a conflicted or failing pull request, a Claude Code task
  merges in the base branch or fixes the failing checks and pushes the result.
  It never merges the pull request. **Only on your own computer.**
- **Rerun.** A pull request failing only on flaky checks (ones that failed,
  then passed on a rerun) has a Rerun button. Preview visitors see the flaky
  tags but no button.
- **Move around.** Drag to pan, scroll to zoom, **Fit** to see everything.
  Cards and screens move by their headers; double-click a header to put it
  back.

### PR screen

Opening a pull request shows it in full without leaving Observatory:

- **Overview, Files, Commits, Checks, Diff and Edit** tabs. Click a commit to
  see its changes beneath it.
- **Viewed** checkboxes fold files away as you review them, and a file that
  changes later comes back unticked.
- **Since last look.** The Diff tab opens on just the changes since you last
  looked, with a switch to the full diff.
- **Merge box.** Along the foot: whether it is a draft, conflicts, how checks
  went, and the review decision. Merge with squash, a merge commit or rebase,
  after one Confirm. It merges only the commit you saw.
- **Preview.** A link to the pull request's preview deployment, where there is
  one.
- **Pipeline.** When agents worked on it, each run as a bar in time.

A dotted line ties the open screen to its star. Merging and editing are yours
alone; preview visitors can only read.

### Issues

The **Issues** view shows a project's issues as a nursery of young stars round
the project's core:

- **Arms.** The most-used labels each get an arm in their colour.
- **Distance** is how long an issue has sat untouched; the rim is the backlog.
- **A dark globule** is an open issue nobody is working on; bigger is older.
- **A lit protostar** has a pull request on it, with one jet per pull request.
- **Moons** are assignees.
- On the Closed tab, **pale stars** were finished and **dust** was dropped.

Switch to **List** for rows, or click an issue to read it in a window.

### Log Sky

The **Logs** view draws an app's own log folder: one group per app window, one
star per distinct error (red) or warning (amber), sized by how often it
happened, ringed if it is still happening. Click one for the message and
threads to the same fault in other windows. Personal details are stripped
before anything reaches the page. Preview visitors see it only if you allow
it, and then more is hidden.

### Usage

The **Usage** view shows your Claude Code limits: the week used so far, where
your pace leads by the reset, the current 5-hour window, and tokens per day,
model and project. Only you see it.

### Retro

**Retro** in the tools looks back over the week: how long merged pull requests
spent stuck in each state, the median time from open to merge for eight weeks,
and merges by the agent that opened them.

### Agent report cards

**Agents** in the tools opens a card per coding agent: how many of its pull
requests merged, are still open, conflict or close no issue, and how long a
merge takes. Each says whether the agent was recorded, inferred or unknown.
Click a card to light only that agent's stars.

## Project tabs

Each project has these screens beside its Review Queue, in the row of tabs at
the top.

### Releases

Your releases fly along a curved path through the night, oldest far off and
newest at the front.

- **Star size** is how many pull requests the release shipped; those pull
  requests circle it as specks on a tilted ring.
- **Star colour** is how far the version moved: a gold flaring giant for a
  major release, a clear blue star for a minor one, a calm pale star for a
  patch, lilac for a tag that isn't a version. A prerelease hides in a veil.
- **The comet** at the front is work merged since the last release. Each knot
  in its tail is one week of merges.

Pick a star, or switch to **List**, to read that release's changelog and every
pull request it shipped. Tags stand in where there are no GitHub releases.

### Actions

Your GitHub Actions workflows, each a lane running back from **now**.

- **Place.** The newest run sits nearest; an idle workflow starts further back.
  A lane whose newest run failed is tinted red.
- **Size** is how long the run took.
- **Kind.** A failed run is a red giant with a bloom and crossed spikes. A
  running one is a bright star sending out rings; a queued one pulses slowly.
  Passed runs are calm; cancelled and skipped ones are veiled.
- **Amber ring.** A run that passed only on a rerun is marked flaky.

Filter by workflow, branch and status, or switch to **List**. Pick a run for
its branch, trigger, who started it, its jobs and failed steps. You get a
**Rerun failed jobs** button; preview visitors see the runs but no button.

### Journal

What each self-review taught, newest first: the first version, the feedback,
what changed and why, and the design principle behind it, linked to the pull
request. Principle chips narrow the list to one idea. A lesson appears once a
review records a second draft, so a new project's Journal starts empty and
says so.

### Library

The project's documentation, read right in Observatory: its wiki when it has a
public one, otherwise its README and docs folder.

- **The index** is a star chart: each shelf is a constellation, each page a
  star sized by its length. The open page's star glows gold.
- **The reading column** is set for long reading, with **On this page** to jump
  between headings and links to the pages either side.
- **Search** narrows the pages by title and text. The arrow keys walk the
  index.

### Depth

Each TypeScript file in the project is drawn as a planet, after John
Ousterhout's idea of deep modules:

- **The core** is the work the file hides inside (its statements).
- **The ring** is what anyone using it has to learn (its exported names,
  parameters and public members).
- **A deep module** is nearly all core: a solid amber sphere. **A shallow one**
  is a thin pink ring round a speck. Balanced ones are blue.

Files are grouped by folder. Hover or Tab to a planet, then use the arrow keys,
to see its numbers, its verdict and the principle behind it. Filter by path or
verdict, or switch to **List**, shallowest first. **Only on your own computer**,
with a copy of the project there.

### Architecture

A map of the project's code, scanned from its clone on your computer each time
you open the tab (a scan takes a few seconds, and Observatory keeps it for a few
minutes), drawn two ways. It charts Angular classes, plain TypeScript files
(modules), the routes of an API server and the outside web services and programs
the code reaches, so a project with no Angular code still has a map:

- **Star system.** The node you pick sits at the centre as a star; everything
  it connects to orbits as a lit world. A hot spot (one of the most often changed
  files) is a flaring red giant; unused code (nothing depends on it and nothing
  starts it) has a dashed outline. The ring round a world names its kind: a
  hollow ring for a component, a plain silver ring for a module, a thick ticked
  coral ring for a route, a dashed lilac ring for an outside service.
- **UML.** The same connections as a diagram, each box with a coloured strip
  down its edge in its kind's colour.

Search by name, filter by area (grouped by where it runs: the browser app, the
API server, web services, programs) or window, and use the **Hot spots** and
**Unused** chips. The two legends name the kinds of node and link the project
has. Links that carry a request at run time (requests, handles, reaches and
spawns) are thicker and brighter than the code links. A card describes the
centre node. **Refresh** scans the clone again. **Open full map** opens the
project in a page of its own that charts every part at once. A project with no
clone here says so, and one the scan finds nothing in says that. **Only on your
own computer.**

### Security

The project's open Dependabot, code-scanning and secret-scanning alerts as one
list, most severe first, each linked to GitHub. The tab shows how many are
open. If a kind can't be read, a plain line says why.

**Sky** shows the same alerts as hazards in belts round the project's world:

- **Belts.** Critical alerts circle innermost, then high, medium and low.
- **Colour and size** follow the grade: red for critical, orange for high,
  amber for medium, grey-blue for low.
- **Shape** says where it came from: a lumpy rock for a dependency, a sharp
  shard for code scanning, a four-pointed spark for a secret.
- **The world's air** takes the worst open grade's colour, or calm green when
  there are none. Critical hazards throb red.

Preview visitors see only the counts, never the alerts themselves.

### Insights

The last twelve weeks of the project in charts:

- commits a week to the main branch,
- the median time from opening a pull request to merging it,
- the top contributors (bots marked) and the pull requests each agent merged,
- traffic: views and clones for the last fourteen days.

The row of stars in the header is one star a week, sized by its commits.
Hover any bar for its numbers, or open **Table view**. Preview visitors see
everything but the traffic.

### Deployments

Each environment, such as Production and Preview, stands as a launch pad along
the foot of the sky.

- **The beacon** on the beam above a pad is its latest deployment: green when
  live, amber while building (sending out rings), red when it failed
  (breathing a red bloom), veiled when replaced.
- **The trail** of the seven before it climbs away, smaller and fainter.
- Production's pad carries a second, wider ring.

Every light links to its deployed site, or its commit when there is none.
**List** shows each environment's deployments with their status, commit, site
and log. Up to six environments show, and the header says when there are more.

### Milestones

Each open milestone is a planet in transit along its own lane toward its due
date:

- **How far along** it sits is how much of its issues and pull requests are
  done.
- **Size** is how many items it holds.
- **Air colour** says how it stands: blue with time to spare, amber when due
  within a week, red once overdue (with a red ring and bloom), green when
  nothing is left open, grey with no due date.

Each planet links to the milestone on GitHub. **List** gives every milestone
with its counts and items, plus the lately closed ones. The project's latest
**Discussions** sit beside the sky, grouped by category, with whether each is
answered. The tab fades back for a project with neither milestones nor
discussions.

## More screens

### Inbox

Your unread GitHub notifications across every repository, as incoming
transmissions: one glass panel per repository, grouped by reason, what waits
on you first.

- **Gold beacons** are things asked of you (a review, an assignment, a
  deployment to approve). Only these pulse, so they keep calling.
- **Blue** is something said to you (a mention, an invitation).
- **Soft red** is a warning (CI runs, security alerts).
- **Grey** is news (threads you opened, joined or watch).

A pull request or issue in a project Observatory charts opens right here;
anything else opens on GitHub. Mark one or all read from the page. Home's top
bar shows your unread count. **Only you**, on your own computer or signed in to
the hosted site; never a preview visitor.

### Agents

The Claude Code agents running on your computer. Each session and helper agent
shows its project, branch, folder, title, when it last wrote and its last tool
call, and whether it is **working**, **waiting for you** or **quiet**. Agents
waiting for you come first. One started to work on its own, such as a task
or a crew, with nobody chatting to it, is tagged **headless**.

Open an agent for its own page:

- **Activity** is a live feed of what it says and does, newest at the bottom.
  **Jump to latest** brings you back if you scroll up.
- **Changes** shows the code it has changed so far, compared with where its
  branch left main, with a link to its pull request.

**Only on your own computer.**
