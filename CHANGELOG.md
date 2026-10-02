# Changelog

All notable changes to observatory are recorded in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
How to add an entry: [docs/changelog.md](docs/changelog.md).

## [Unreleased]

### Added

- Heart the track playing (or any track in the list) to save it as a favourite in this browser, and switch the playlist between the day's mix and your favourites from the bar ([#242](https://github.com/anthonyturner/observatory/pull/242)).
- Home's sky moves with the playlist once you share the tab's audio: each track gets its own look (shockwave rings, a warp-speed star stream, aurora ribbons or a breathing nebula) in trance or techno colours, pulsing on the kicks, sparkling on the hats and bursting on a drop, while the core keeps its own glow ([#239](https://github.com/anthonyturner/observatory/pull/239)).
- The architecture map shows which component uses which, what each provider list and token hands out, inheritance and calls to injecting functions, each as its own colour of link. A Window filter shows what each Overwolf window pulls in, and two classes that share a name are no longer merged ([#231](https://github.com/anthonyturner/observatory/pull/231)).
- A trance and techno playlist on Home, shuffled fresh on each visit and played from YouTube through a transport bar at the foot of the page, with a track list and its own volume; it takes over from the Sound button's score rather than playing over it ([#233](https://github.com/anthonyturner/observatory/pull/233), [#237](https://github.com/anthonyturner/observatory/pull/237)).
- An architecture map at `/architecture` that scans a project's services and draws them as a turning star system and as a UML diagram, with search, an area filter and Hot spots / Unused chips ([#230](https://github.com/anthonyturner/observatory/pull/230)).
- Home, an animated space scene around a glowing core that draws in 3D where the browser can and in 2D where it can't, with a top bar, a clock and a help card ([#3](https://github.com/anthonyturner/observatory/pull/3), [#7](https://github.com/anthonyturner/observatory/pull/7), [#11](https://github.com/anthonyturner/observatory/pull/11), [#23](https://github.com/anthonyturner/observatory/pull/23), [#25](https://github.com/anthonyturner/observatory/pull/25), [#41](https://github.com/anthonyturner/observatory/pull/41)).
- Live project cards, open issues and Directives (the three most blocked pull requests) on Home, read from GitHub ([#13](https://github.com/anthonyturner/observatory/pull/13), [#27](https://github.com/anthonyturner/observatory/pull/27), [#37](https://github.com/anthonyturner/observatory/pull/37)).
- A vitals column with live Claude Code usage meters, read by Observatory itself, a summary in the top bar and Documents tabs ([#15](https://github.com/anthonyturner/observatory/pull/15), [#19](https://github.com/anthonyturner/observatory/pull/19), [#21](https://github.com/anthonyturner/observatory/pull/21), [#43](https://github.com/anthonyturner/observatory/pull/43)).
- Skill tiles on Home ([#17](https://github.com/anthonyturner/observatory/pull/17)).
- Turn the core by dragging it or with the arrow keys, see it glow under the pointer, and click a project's dot to jump to its card ([#33](https://github.com/anthonyturner/observatory/pull/33), [#47](https://github.com/anthonyturner/observatory/pull/47)).
- The core shows project health: its mood strains as work gets blocked, stale projects fade on its ring, new data sends a ripple across the floor, and progress sets off green bursts and comets ([#45](https://github.com/anthonyturner/observatory/pull/45), [#49](https://github.com/anthonyturner/observatory/pull/49), [#53](https://github.com/anthonyturner/observatory/pull/53), [#55](https://github.com/anthonyturner/observatory/pull/55)).
- A night sky over Home, with a rain of comets (one per open issue) and star trails turning about the core ([#35](https://github.com/anthonyturner/observatory/pull/35), [#39](https://github.com/anthonyturner/observatory/pull/39), [#188](https://github.com/anthonyturner/observatory/pull/188)).
- Home's star trails turn faster or slower with the day's activity, with a Spin lever and a help section for the sky ([#210](https://github.com/anthonyturner/observatory/pull/210), [#214](https://github.com/anthonyturner/observatory/pull/214)).
- A Motion button that overrides the system's reduced-motion setting ([#29](https://github.com/anthonyturner/observatory/pull/29)).
- A Sound button that plays a score generated live in the browser, which grows uneasy as projects strain and chimes for each project ([#31](https://github.com/anthonyturner/observatory/pull/31), [#59](https://github.com/anthonyturner/observatory/pull/59), [#125](https://github.com/anthonyturner/observatory/pull/125)).
- Fog over Home and the Orrery as the project data ages ([#61](https://github.com/anthonyturner/observatory/pull/61), [#200](https://github.com/anthonyturner/observatory/pull/200)).
- The Orrery, a solar system of your projects, linked with Home, with its own score, a 3D view, Refresh, a volume slider and Controls on a small screen ([#57](https://github.com/anthonyturner/observatory/pull/57), [#121](https://github.com/anthonyturner/observatory/pull/121), [#192](https://github.com/anthonyturner/observatory/pull/192), [#208](https://github.com/anthonyturner/observatory/pull/208)).
- A star map of each project's review queue, blocked first, drawn in 3D with a 2D fallback, with a legend, tools, a list, a detail card for each star and comets for unclaimed issues ([#63](https://github.com/anthonyturner/observatory/pull/63), [#67](https://github.com/anthonyturner/observatory/pull/67), [#87](https://github.com/anthonyturner/observatory/pull/87), [#90](https://github.com/anthonyturner/observatory/pull/90), [#96](https://github.com/anthonyturner/observatory/pull/96), [#108](https://github.com/anthonyturner/observatory/pull/108)).
- A pull request screen with Overview, Files, Commits, Checks, Diff and Edit tabs ([#65](https://github.com/anthonyturner/observatory/pull/65), [#103](https://github.com/anthonyturner/observatory/pull/103)).
- An Issues screen for each project, nobody-on-it first, with its own sky, issue card and issue window ([#69](https://github.com/anthonyturner/observatory/pull/69), [#105](https://github.com/anthonyturner/observatory/pull/105), [#115](https://github.com/anthonyturner/observatory/pull/115)).
- Triage in the review queue: mark pull requests seen, snooze them or dismiss them ([#71](https://github.com/anthonyturner/observatory/pull/71)).
- Since you last looked: the review queue remembers each refresh and shows what changed, with a changes panel, a timeline and a replay ([#73](https://github.com/anthonyturner/observatory/pull/73), [#104](https://github.com/anthonyturner/observatory/pull/104)).
- Collision courses, which open pull requests would conflict with each other, and a merge plan that orders them ([#75](https://github.com/anthonyturner/observatory/pull/75), [#110](https://github.com/anthonyturner/observatory/pull/110)).
- The star map fogs when its refreshes fail instead of going blank, and its help explains every kind of fog ([#79](https://github.com/anthonyturner/observatory/pull/79), [#196](https://github.com/anthonyturner/observatory/pull/196)).
- Help and sound on the star map and the Orrery, with a help card for each screen and pings when you pick a star or a comet ([#77](https://github.com/anthonyturner/observatory/pull/77), [#112](https://github.com/anthonyturner/observatory/pull/112), [#114](https://github.com/anthonyturner/observatory/pull/114), [#183](https://github.com/anthonyturner/observatory/pull/183)).
- The Log Sky, which reads an app's log folder and draws it in the star map's Logs tab, with log threads inside the 3D sky ([#92](https://github.com/anthonyturner/observatory/pull/92), [#99](https://github.com/anthonyturner/observatory/pull/99), [#206](https://github.com/anthonyturner/observatory/pull/206)).
- A Usage screen on the star map, with plan limits, pace and token charts ([#100](https://github.com/anthonyturner/observatory/pull/100)).
- Agent report cards on the star map, the import of pr-starmap's handoff history, and per-agent usage on Home (runs, tokens and peak context) ([#117](https://github.com/anthonyturner/observatory/pull/117), [#177](https://github.com/anthonyturner/observatory/pull/177), [#219](https://github.com/anthonyturner/observatory/pull/219)).
- A hosted site on Vercel: sign in with GitHub, an optional read-only public preview, a scheduled refresh and a way to push local-only data up ([#88](https://github.com/anthonyturner/observatory/pull/88), [#93](https://github.com/anthonyturner/observatory/pull/93), [#97](https://github.com/anthonyturner/observatory/pull/97)).
- Jev, Home's assistant: ask in the Ask panel and get actions, quick answers or proposed tasks, with the core's state chips showing what it is doing ([#51](https://github.com/anthonyturner/observatory/pull/51), [#133](https://github.com/anthonyturner/observatory/pull/133), [#135](https://github.com/anthonyturner/observatory/pull/135), [#139](https://github.com/anthonyturner/observatory/pull/139)).
- Jev holds a conversation and uses the dashboard as its tools ([#149](https://github.com/anthonyturner/observatory/pull/149)).
- Jev looks things up on the web and lists its sources, which open in a floating reader window ([#145](https://github.com/anthonyturner/observatory/pull/145), [#153](https://github.com/anthonyturner/observatory/pull/153)).
- Run a task Jev proposes from Home once you press Run, and follow it in a task dock ([#134](https://github.com/anthonyturner/observatory/pull/134), [#141](https://github.com/anthonyturner/observatory/pull/141)).
- Talk to Jev by tapping, holding M or pressing the core, and hear replies read aloud, in the browser or with an ElevenLabs voice you pick ([#136](https://github.com/anthonyturner/observatory/pull/136), [#137](https://github.com/anthonyturner/observatory/pull/137), [#140](https://github.com/anthonyturner/observatory/pull/140), [#143](https://github.com/anthonyturner/observatory/pull/143), [#202](https://github.com/anthonyturner/observatory/pull/202)).
- A voice ring on the core that swells as you speak ([#190](https://github.com/anthonyturner/observatory/pull/190)).
- A News section on Home with AI and software engineering stories, each with a summary and a picture or a playable video, and jump links ([#161](https://github.com/anthonyturner/observatory/pull/161), [#163](https://github.com/anthonyturner/observatory/pull/163), [#165](https://github.com/anthonyturner/observatory/pull/165), [#167](https://github.com/anthonyturner/observatory/pull/167), [#169](https://github.com/anthonyturner/observatory/pull/169)).
- The review queue in a terminal, with `npm run queue` ([#204](https://github.com/anthonyturner/observatory/pull/204)).
- This changelog, filled in from the pull requests merged so far ([#225](https://github.com/anthonyturner/observatory/pull/225)).

### Changed

- Home's music is a trance groove with a lead melody, and it steps back while the mic is listening ([#173](https://github.com/anthonyturner/observatory/pull/173), [#175](https://github.com/anthonyturner/observatory/pull/175), [#179](https://github.com/anthonyturner/observatory/pull/179)).
- Home and Help sit in the same place on every screen, and Home's tools move to a toolbar at the bottom ([#198](https://github.com/anthonyturner/observatory/pull/198), [#210](https://github.com/anthonyturner/observatory/pull/210)).
- Jev runs on the owner's Claude Code subscription instead of OpenRouter ([#159](https://github.com/anthonyturner/observatory/pull/159)).
- Jev speaks and hears with ElevenLabs by default, falling back to the in-browser models when ElevenLabs can't ([#155](https://github.com/anthonyturner/observatory/pull/155), [#157](https://github.com/anthonyturner/observatory/pull/157)).
- The ElevenLabs key is read from `ELEVENLABS_OBSERVATORY_KEY`, so a key set for another app no longer takes its place ([#171](https://github.com/anthonyturner/observatory/pull/171)).

### Removed

- The assistant and voice are no longer available on the hosted site, for anyone ([#151](https://github.com/anthonyturner/observatory/pull/151)).

### Fixed

- The hosted star map reads checks with a fine-grained GitHub token instead of failing ([#119](https://github.com/anthonyturner/observatory/pull/119), [#123](https://github.com/anthonyturner/observatory/pull/123)).
- ElevenLabs reads a reply in one breath instead of in choppy pieces ([#147](https://github.com/anthonyturner/observatory/pull/147)).
- Refresh reads GitHub right away instead of a cached answer, and Home's Refresh button works ([#181](https://github.com/anthonyturner/observatory/pull/181)).
- On the Orrery, the pointer can reach a world's card before it hides ([#194](https://github.com/anthonyturner/observatory/pull/194)).
- The weekly usage gauge reads plan limits live and shows today's share of the week ([#222](https://github.com/anthonyturner/observatory/pull/222)).
