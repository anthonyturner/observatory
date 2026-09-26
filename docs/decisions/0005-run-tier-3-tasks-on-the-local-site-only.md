# ADR-0005: Run tier-3 tasks on the local site only, after a confirmed proposal

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Anthony Turner (maintainer), in issue #131
- **Related:** [#131](https://github.com/anthonyturner/observatory/issues/131), [#127](https://github.com/anthonyturner/observatory/issues/127); adapted from pr-starmap's [ADR-0004: Run tier-3 tasks on the local site, only after a confirmed proposal](https://github.com/anthonyturner/pr-starmap/blob/main/docs/decisions/0004-run-tier-3-tasks-on-the-local-site.md), which is its source

## Context

Observatory is being rebuilt piece by piece from pr-starmap, which decided in
its ADR-0004 to let its local site run a confirmed tier-3 request as Claude
Code. Observatory's assistant (#127) sorts requests into tiers, and tier 3 is
work in a project: reading or changing code, running commands. Until this
change Observatory could only show the `claude -p` command for such a request.

Observatory has two servers built from one code base: the local API
(`server/main.ts`), bound to 127.0.0.1 and acting as whoever `gh` is signed in
as, and the hosted API (`server/hosted/hosted-api.ts`), on the internet behind
a GitHub sign-in. Running Claude Code is running code as this machine's user,
so where the runner lives moves the trust boundary: a request that reaches it
can run a program here, not only change triage state or a pull request.

## Decision

We will let the **local API only** start a tier-3 request as Claude Code,
`claude -p --output-format stream-json --verbose`, after the owner confirms a
proposal, with the same limits pr-starmap set:

- **Where.** Only `server/main.ts` creates a runner (`server/runner/`). The
  hosted API has none: its `/api/runs` answers 404, and its tier-3 proposal is
  a command to copy.
- **Confirmation.** A run needs a proposal token: random, single use, valid for
  5 minutes, bound to the exact prompt and folder the proposal showed, and at
  most 32 waiting at once. `POST /api/runs` refuses a missing, expired, reused
  or mismatched token before anything is spawned, whatever the page did.
- **Folder.** A run's folder is a project's clone as `CloneFinder` finds it
  (`clones.json`, or the scan of `OBSERVATORY_CLONES_ROOT`), checked when the
  token is made and again when it is used. The request never names a folder of
  its own, and there is no fallback to the home folder.
- **How Claude runs.** The prompt goes on stdin, never as an argument; on
  Windows `claude` is a `.cmd` shim that Node starts only through cmd.exe,
  which would read the prompt's `%`, `&` and quotes as its own syntax. The run
  keeps the owner's own permission rules and hooks: there is no
  `--dangerously-skip-permissions`, and `-p` refuses a tool the rules do not
  allow. The server's own credentials (`OPENROUTER_API_KEY`,
  `OBSERVATORY_PUSH_TOKEN`, `SESSION_SECRET`) are removed from its environment.
- **Limits.** One run at a time. A run stops at 30 minutes. Cancel kills the
  process and everything it started (`taskkill /T /F` on Windows, the process
  group elsewhere), and so does the API stopping. A run's output is held in
  memory, at most 2 MB of the newest, with any single line over 256 KB kept as
  its head; the last 5 finished runs are listed.
- **Who may ask.** `/api/runs` refuses a Host header that is not a loopback
  name (DNS rebinding), a foreign `Origin`, and a POST or DELETE with no
  `Origin`. POST and DELETE also need the `x-observatory` header, as every
  write does.

## Alternatives considered

- **Keep tier 3 copy-only.** Safest, and still what the hosted site does. It
  leaves the assistant one manual step short of the work, which is what the
  maintainer asked to remove.
- **Run on the hosted site too.** It would need a runner with the owner's code
  and credentials on a public server. Rejected outright.
- **Trust the page's confirmation alone.** Any local caller that can reach the
  API could skip the page. The token makes the server check the proposal
  itself.
- **Pass the prompt as an argument.** See "How Claude runs": cmd.exe would
  interpret it.
- **Server-Sent Events for the output.** `EventSource` cannot send a custom
  header, so the stream could never be held to the rules every other call
  keeps. A streamed `fetch` of NDJSON can.
- **Allow only this server's own origin, as pr-starmap does.** In development
  the page comes from `ng serve` on another port and is proxied here, so its
  `Origin` names that port. Any loopback origin is accepted instead; a page on
  another local port still cannot send `x-observatory` without a preflight this
  server never approves.
- **`--dangerously-skip-permissions`.** A run would do anything Claude
  decided to, unasked. The owner's allow rules are the limit on what a run can
  touch.

## Consequences

- **What this makes easier.** A request can go from words on the page to real
  work in a project, with its output visible as it arrives, and be stopped
  with one click.
- **What this makes harder, or what it costs.**
  - The local API is now a way to run code. **Accepted risk:** any other
    program, or another Windows account, on this machine can reach the port,
    ask for a proposal and start a run. That is accepted for a single-user
    machine and is not closed.
  - A run starts the owner's global Claude Code hooks, as any `claude -p` on
    this machine does, and they can take many seconds before Claude answers.
  - A cancelled or timed-out run leaves whatever it already changed.
  - Killing a process tree can fail. The runner stops waiting for output 5 s
    after Claude's own process ends, and a kill that has not worked after a
    second try (10 s each) ends the run anyway and says to check Task Manager,
    so the next run can start; it cannot prove every grandchild is gone.
  - Runs cost the owner's Claude usage, and their output lives only in the
    API's memory.
  - The http layer now allows a route to answer with its own `Response` (a
    status other than 200, or a stream) and has DELETE routes, which other
    routes may now use too.
- **What now has to be true.**
  - Only `server/main.ts` creates a runner; `server/hosted/` and `api/` never
    do.
  - `POST /api/runs` spawns nothing without a matching, unexpired, unused
    token, and checks the folder against the clones again.
  - The prompt never appears in the spawned command line.
  - The runner never passes `--dangerously-skip-permissions` or any
    permission-widening flag.
  - Nothing on the page starts a run except Run itself, pressed by the owner.

## Compliance

- `grep -rn "localRunner\|withRunsRoutes\|new Runner" server api --include=*.ts`
  finds them created only in `server/main.ts` (and tests).
- `CLAUDE_ARGS` in `server/runner/claude-command.ts` is a fixed list with no
  permission flags, and `process.stdin.end(this.proposal.prompt)` in
  `claude-run.ts` is the only place the prompt goes.
- Tests hold the rest: `runner.test.ts` (used, expired and mismatched tokens,
  the folder check on use, one at a time, the time limit, cancel, the failed
  kill), `claude-launcher.test.ts` (the fixed flags, the shim's command line,
  the withheld credentials), `runs-guard.test.ts` (Host and Origin), and
  `hosted-api.test.ts` ("has no runs routes").
- In review: any change to the gate, the folder rule, the spawn or the kill
  must say how it keeps the "now has to be true" points above.
