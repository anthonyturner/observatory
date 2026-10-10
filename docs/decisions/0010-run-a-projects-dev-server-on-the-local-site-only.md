# ADR-0010: Run a project's dev server on the local site only

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Anthony Turner (maintainer), in issue #590
- **Related:** [#590](https://github.com/anthonyturner/observatory/issues/590); extends the local-only tier of [ADR-0005](0005-run-tier-3-tasks-on-the-local-site-only.md) and [ADR-0006](0006-keep-the-assistant-on-the-local-site-only.md)

## Context

Previewing a project meant leaving Observatory: open a terminal, find the
checkout, start its dev server, find the port it chose. Observatory already
knows where each project lives on this machine (`CloneFinder`) and already
starts processes there (ADR-0005). Issue #590 adds a **Run** button to the
project screen and to Home's project cards that starts the project's dev server
and opens its site.

A dev server is a project's own code running as this machine's user, so the
trust boundary moves again, exactly as it did for tier-3 runs.

## Decision

We will let the **local API only** start, report and stop a project's dev
server, through one module, `server/dev-servers/`, on these terms:

- **Where.** Only `server/main.ts` creates the module and its routes
  (`GET`, `POST`, `DELETE /api/dev-servers`). The hosted API has none: the
  routes answer 404 for everyone, the owner included. The page shows no button
  and makes no call for a session that is not `isConfirmedLocal()`.
- **Who may ask.** The routes sit behind `guardLoopback` (Host and Origin must
  name this machine), and a start or stop also needs the `x-observatory` header,
  as every write does. The request names only `owner/name`, validated as a
  GitHub repository name.
- **Folder.** The checkout comes only from the known-checkouts registry
  (`cloneCheckouts`), read afresh on each start. The request never names a
  folder, and there is no fallback to another one.
- **Command.** The owner's entry for the project in
  `~/.claude/observatory/run.json` (`{"owner/repo": {"command", "url"}}`), else
  `npm run dev`, else `npm start`, chosen from the checkout's `package.json`.
  Never text from a request. The server's own credentials are removed from the
  environment, as for a run.
- **Address.** An address the server prints whose parsed host is `localhost`,
  `127.0.0.1` or `[::1]`, with a port, terminal colour codes and trailing
  punctuation stripped. One on a line labelled `Local:` wins; otherwise the
  first one printed is used after a short wait. A script that runs several
  servers (an API and a site) may still pick the wrong one: give it a `url` in
  `run.json`, which always wins. A server that prints none within two minutes is
  stopped and says so.
- **Limits.** One server per project; starting again returns the running one.
  Stop ends the whole process tree (`taskkill /T /F` on Windows, the process
  group elsewhere), and so does the API exiting.

## Alternatives considered

- **Run it from the page without the API.** A browser cannot start a process.
- **Let the request name the command or folder.** Any local program or rebound
  page that reached the API could then run anything. The registry's folder and
  the two fixed npm lines (or the owner's own file) are the only things that can
  run.
- **Reuse the runner (`/api/runs`).** It is built for one Claude Code run at a
  time, with confirmation tokens, a 30-minute limit and an output log. A dev
  server is long-lived and one per project, so most of the runner's rules would
  have needed switching off.
- **Run it on the hosted site, or show a hosted owner the button.** A hosted
  owner can write, but running code needs this machine; the hosted site would
  need a runner holding the owner's code. Rejected as in ADR-0005.
- **Keep a fixed port per project.** It would collide with Observatory itself
  and with other projects. Reading the printed address needs no configuration.

## Consequences

- **What this makes easier.** Previewing a project is one click from where the
  project is already shown, with the address found for you and one click to stop.
- **What this makes harder, or what it costs.**
  - The local API is now a second way to run code. **Accepted risk**, as in
    ADR-0005: any other program or account on this machine can reach the port
    and start the dev server of a project that has a checkout here.
  - A dev server keeps running until stopped or the API exits. One the owner
    started by hand on the same port will clash, and the new one fails with its
    own words.
  - A server that prints no localhost address needs a `url` in `run.json`, and
    is reported as running as soon as it starts, whether or not it is listening.
  - A kill can fail; Stop then reports nothing more than the API can know.
- **What now has to be true.**
  - Only `server/main.ts` creates the dev servers; `server/hosted/` and `api/`
    never do.
  - The folder comes from the registry, and the command from `run.json` or the
    two fixed npm lines, never from a request.
  - The button renders and the API is called only after `isConfirmedLocal()`.

## Compliance

- `grep -rn "localDevServers\|withDevServerRoutes" server api --include=*.ts`
  finds them created only in `server/main.ts` (and tests).
- `hosted-api.spec.ts` ("has no runs, crew or dev-server routes") and
  `visitor-routes.spec.ts` hold the hosted side; `dev-servers-routes.spec.ts`
  holds the guard, the write header and the repository check.
- `dev-servers.spec.ts` holds the registry-only folder, reuse, stop and exit
  cleanup; `run-preview-button.spec.ts` holds the button's absence off this
  machine.
- In review: any change to how a command, folder or address is chosen must say
  how it keeps the "now has to be true" points above.
