# Observatory

An Angular dashboard that charts a developer's open pull requests, projects and
coding agents as an animated space scene: a glowing core that shows what the
assistant is doing, a card per project, and gauges for the work waiting on you.

Observatory is a rebuild of [pr-starmap](https://github.com/anthonyturner/pr-starmap),
whose pages grew into single HTML files thousands of lines long. It is being
migrated one small piece at a time into typed, tested Angular components.

> **Status:** Home, the Orrery and each project's review queue are built. Home's
> project cards, usage meters, directives and top bar, every world on the
> Orrery, and the review queue's star map show live data from GitHub and
> Claude Code; the assistant panel and the skills are there to look
> at but not connected yet.

## Stack

- **Angular 22**: standalone components, signals, `OnPush` change detection
- **TypeScript 6**, strict mode
- **Angular CDK** for behaviour (overlays, focus management, accessibility,
  breakpoints), with a hand-built design system instead of a component library
- **Three.js** for the 3D core, with a Canvas 2D fallback
- **Vitest** for unit tests, **angular-eslint** and **Prettier** for code quality

## Principles

The code is written to SOLID and Clean Code standards
([docs/stack/clean-code.md](docs/stack/clean-code.md)): small single-purpose
components and services, dependencies on interfaces rather than concrete
implementations, and no file that does more than one job.

## Running it

Requires Node.js 24.15 or newer.

```bash
npm ci
npm start          # http://localhost:4200
npm test -- --watch=false
npm run test:server
npm run lint
npm run build
```

## Live data

The usage meters (tokens today, the 5-hour window and the weekly limit), the
project cards and Open issues are live. `npm start` runs Observatory's own API (`server/`, on port 4319) next to
the Angular dev server, which proxies `/api` to it. The API reads Claude Code's
files on this machine, so it listens on loopback only:

- **Tokens** come from Claude Code's session logs in `~/.claude/projects`, each
  reply counted once, by local day and model family.
- **Limits** come from your status line, the one place Claude Code reports
  them. Add this to a Node status line script, where `status` is the JSON it
  was given on stdin:

  ```js
  import('file:///path/to/observatory/server/usage/limit-recorder.ts')
    .then((m) => m.record(status))
    .catch(() => {});
  ```

  Readings are kept in `~/.claude/observatory/usage/`. Without them the limit
  meters say so rather than showing a number.

- **Projects** (the cards, Open issues, Directives, the Documents tabs and the top bar) are every repository the account signed in to the
  [GitHub CLI](https://cli.github.com/) owns (no forks or archives), read
  through `gh` and cached for five minutes. Each open pull request is counted
  in its most urgent state: cannot merge, checks failing, mergeability
  unknown, no issue linked, or waiting on you.

- **Review queue** (`/p/<owner>/<repo>`, reached from an Orrery world): the
  open pull requests as a star map or a list, blocked first, with a panel per
  pull request and the Issues tab.
- **Triage**: mark a pull request seen, snooze it or dismiss it until it
  changes. Kept in `~/.claude/observatory/triage/`; nothing is written to
  GitHub.
- **Since you last looked**: each read of a queue from GitHub may record a
  frame (every open pull request's bucket) in `~/.claude/observatory/history/`,
  and the review queue lists and marks what changed since your last visit.
  GitHub keeps no history of mergeability, so this starts from the first frame.

- **Collision courses**: pairs of open pull requests that change the same file
  are merged in memory with `git merge-tree` in a local clone, to show which
  would conflict with each other: a red thread on the star map, and a list in
  each panel. Pull request heads are fetched into `refs/observatory/` and
  deleted afterwards; branches and files are never touched. The clone is found
  in `~/.claude/observatory/clones.json` (`{"owner/repo": "path"}`) or by
  scanning `OBSERVATORY_CLONES_ROOT` (by default the folder holding this
  checkout). Without one, the pairs are shown as unchecked, never as safe.

Skills are still sample data.

## Working on it

Changes follow the workflow in [AGENTS.md](AGENTS.md): every change starts as a
GitHub issue and lands through a pull request.
