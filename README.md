# Observatory

An Angular dashboard that charts a developer's open pull requests, projects and
coding agents as an animated space scene: a glowing core that shows what the
assistant is doing, a card per project, and gauges for the work waiting on you.

Observatory is a rebuild of [pr-starmap](https://github.com/anthonyturner/pr-starmap),
whose pages grew into single HTML files thousands of lines long. It is being
migrated one small piece at a time into typed, tested Angular components.

> **Status:** early. The app shell is in place; Home's widgets are being
> migrated next, starting with their look and sample data.

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
- **Projects** are every repository the account signed in to the
  [GitHub CLI](https://cli.github.com/) owns (no forks or archives), read
  through `gh` and cached for five minutes. Each open pull request is counted
  in its most urgent state: cannot merge, checks failing, mergeability
  unknown, no issue linked, or waiting on you.

Directives, documents, skills and the top bar are still sample data.

## Working on it

Changes follow the workflow in [AGENTS.md](AGENTS.md): every change starts as a
GitHub issue and lands through a pull request.
