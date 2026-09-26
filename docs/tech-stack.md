# Tech stack

What observatory is built on. Keep it to a short list: the language, the
framework, the main libraries, where data lives, and how it is built and
deployed. Agents read this to avoid proposing a tool the project does not use,
so a missing line costs more than a long one.

- Node.js and strict TypeScript — rules in [stack/typescript.md](stack/typescript.md)
- Angular — conventions in [stack/angular.md](stack/angular.md) and
  [stack/ui-components.md](stack/ui-components.md)
- Angular 22 (standalone components, signals, OnPush), strict TypeScript 6,
  Angular CDK for behaviour (overlays, focus, a11y, breakpoints) with no
  component library: the look is the project's own design tokens and
  per-component CSS. Three.js for the 3D core, with a Canvas 2D fallback.
- API: `server/`, a small Node server in TypeScript, run by Node directly
  (type stripping, no build) on loopback port 4319; `ng serve` proxies `/api`
  to it (`proxy.conf.json`). Node built-ins only. Tests: `node:test`.
- Data: Claude Code usage is live, read from this machine's session logs
  (`~/.claude/projects`) and the status line's limit readings
  (`~/.claude/observatory/usage/`). Projects and open issues are live from
  GitHub through the `gh` CLI (`server/github/`), as its signed-in account.
  Everything else is still sample data. No
  secrets live in this repository.
- Build: Angular CLI (`ng build`, esbuild). Tests: Vitest through `ng test`.
  Lint: angular-eslint. Format: Prettier. Deployment: not yet decided.
- CI: none yet.
