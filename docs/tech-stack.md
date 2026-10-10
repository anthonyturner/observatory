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
  to it (`proxy.conf.json`). Node built-ins, plus `imapflow` for reading the
  owner's iCloud and Gmail inboxes over IMAP (`server/mail/`, local only).
  The Sync sound card source hears the speakers through a small C# WASAPI
  loopback helper (`server/sound-card/wasapi-loopback.cs`) that the Windows
  PowerShell 5.1 shipped with Windows compiles at start: Windows only, local
  only, no npm dependency. Tests: `node:test`, named `*.spec.ts` like the
  app's, so every test in the repository has one suffix.
- Data: Claude Code usage is live, read from this machine's session logs
  (`~/.claude/projects`) and the status line's limit readings
  (`~/.claude/observatory/usage/`). Projects, open issues and the directives are live from
  GitHub through the `gh` CLI (`server/github/`), as its signed-in account.
  Everything else is still sample data. No
  secrets live in this repository.
- Voice: Whisper base.en (hears) and Kokoro-82M (speaks) run in the browser, in a
  web worker (`src/app/core/voice/worker/`), on WebGPU with a processor
  fallback. transformers.js 4.3.0, kokoro-js 1.2.1 and phonemizer 1.2.1 load
  at run time from pinned jsDelivr files (the last two SHA-256 checked), and
  the weights from pinned Hugging Face commits: none are npm dependencies.
- Architecture map viewer: `viewer/architecture-map/`, plain TypeScript for the browser (no
  framework) that esbuild bundles with ELK.js (`elkjs`, layout) into one self-contained HTML
  file (`npm run arch:html`, built by `server/architecture/architecture-html.ts`). Tests:
  `node:test` (`npm run test:viewer`); type check: `npm run typecheck:viewer`.
- Architecture map contract: `server/architecture/architecture-types.ts` is the one home of the
  map's kinds and shapes. The viewer and the Architecture tab (`src/app/core/architecture/`)
  import it, so a kind the scanner adds is a compile error in both until it has a look.
- Build: Angular CLI (`ng build`, esbuild). Tests: Vitest through `ng test`.
  Lint: angular-eslint. Format: Prettier. Deployment: not yet decided.
- CI: GitHub Actions runs one workflow, **Wiki sync**
  (`.github/workflows/wiki-sync.yml`), which publishes the README and chosen
  `/docs` pages to the wiki on every merge to main. No build or test checks yet.
