# ADR-0011: Preview a pull request in a worktree, on the local site only

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Anthony Turner (maintainer), in issue #595
- **Related:** [#595](https://github.com/anthonyturner/observatory/issues/595); extends [ADR-0010](0010-run-a-projects-dev-server-on-the-local-site-only.md), and with it [ADR-0005](0005-run-tier-3-tasks-on-the-local-site-only.md) and [ADR-0006](0006-keep-the-assistant-on-the-local-site-only.md)

## Context

Run (ADR-0010) starts a project's dev server in its clone, which shows whatever
that clone has checked out. Reviewing a pull request visually meant checking its
branch out by hand, in the same folder the owner is working in.

Previewing a pull request runs three more kinds of code on this machine as this
user: git fetches the branch from GitHub, `npm ci` runs the pull request's
install scripts, and the dev server runs the pull request's code. Anyone able to
open a pull request against a project can change all three, so this widens
ADR-0010's boundary and needs its own record.

## Decision

We will let the **local API only** preview one pull request of a project that
has a clone here, by extending the `server/dev-servers/` module, on these
terms:

- **One module, keyed by a target.** A dev server belongs to a _target_: the
  project's checkout, or one pull request of it. `start`, `status` and `stop`
  take the target; each target has at most one server, and the status says which
  phase a starting one is in: fetching, installing, starting.
- **Where and who.** Unchanged from ADR-0010: only `server/main.ts` creates the
  module, the routes answer 404 on the hosted API for everyone, and they sit
  behind `guardLoopback` and, for a start or stop, the `x-observatory` header.
  The page shows the button and calls the API only after `isConfirmedLocal()`.
  The request adds one field, `pull`, validated as a positive whole number of at
  most nine digits. Nothing else of the request reaches a command or a path.
- **Folder.** `<clone>/.claude/worktrees/observatory-pr-<number>`, where the
  clone is the registry's. The folder is built from the validated number, never
  taken from a request. Its parent is added to the clone's `.git/info/exclude`,
  which git never commits. The name is prefixed because that folder also holds
  the worktrees the owner and agents make, such as `pr-12`.
- **Ownership.** When Observatory creates a worktree it writes a marker file,
  `observatory-preview`, into git's own folder for that worktree, found through
  the `.git` file in it. It reuses, refreshes, prunes and removes only worktrees
  with that marker. Any other folder at that path is reported as in the way and
  left untouched. A refresh also refuses a worktree with changes that are not
  the preview's own (it ignores `node_modules`, `.env` files and a generated
  `package-lock.json`), so the owner's edits are never overwritten.
- **Commands.** git runs with an argument list and no shell:
  `fetch --no-write-fetch-head origin +refs/pull/<n>/head:refs/observatory/pull/<n>`
  (the ref GitHub keeps for every pull request, forks included, fetched into a
  private ref that a fetch of the owner's cannot overwrite as it does
  `FETCH_HEAD`), then `worktree add --detach <folder> <commit>` on a new folder
  or `checkout --detach --force <commit>` on one it made earlier, so no branch
  is ever created in the user's repository. The install is `npm ci` when there
  is a `package-lock.json`, else `npm install`; npm is a batch file on Windows,
  so it is the only command that goes through the shell, as a line made of one
  of those two fixed words. git is told never to prompt, and neither tool gets
  the API's own credentials. The dev server then starts as in ADR-0010, with the
  worktree as its folder.
- **Settings files.** The clone's top-level `.env` files are copied into a new
  worktree if it lacks them, since git does not carry them. Nothing is ever
  linked: not `node_modules`, not anything else.
- **Time.** A fetch gets two minutes and an install ten, each its own limit. The
  server's two-minute wait for its site starts when the server does, so a slow
  install never counts against it.
- **Stop.** Stop ends the process tree, waits for the server to be gone, then
  deletes the worktree's folder itself with long-path-safe calls, runs
  `git worktree prune`, and deletes the private ref. It never uses
  `git worktree remove`: git on Windows follows junctions, and an install
  creates them for workspaces and `file:` dependencies that the pull request
  controls. A removal that cannot be done is reported as a failed status, not
  hidden, and a failed preview offers Remove for the same reason.
- **What may be deleted.** Every deletion passes two tests first: the path is
  exactly a folder named `observatory-pr-<number>` directly under that clone's
  `.claude/worktrees/`, and the worktree carries Observatory's marker. A link is
  removed, never followed into what it points at.
- **One at a time.** Everything that changes one worktree (a start, a refresh,
  a removal, a prune) runs in a queue for that worktree, and a prune asks again
  whether a server holds it just before it deletes.
- **API exit and clean-up.** Quitting the API ends the servers and any git or
  npm still running, but leaves the worktrees so a restart can reuse them. When
  a preview starts, the worktrees of pull requests that are no longer open, and
  that no server is using, are removed. If whether one is open cannot be read, it
  stays.

## Alternatives considered

- **Check the branch out in the clone.** It would change the folder the owner
  is working in and could clobber uncommitted work. A worktree is the isolation
  git offers.
- **A fresh shallow clone per pull request.** It needs no worktree bookkeeping
  but re-downloads the repository and its history for every preview, and a
  private repository needs credentials copied to a second place.
- **Link `node_modules` from the clone to skip the install.** Rejected as the
  project's rules reject it everywhere: one tree's change then rewrites the
  other's dependencies, and the pull request's own dependency changes are exactly
  what a preview is meant to show.
- **Remove with `git worktree remove`, and fall back to our own delete.** Git's
  removal is the one that follows junctions, so it must not run first. Deleting
  ourselves, then pruning, is the whole path.
- **Treat any `pr-<n>` folder as a preview.** That folder holds the owner's own
  worktrees, and a refresh would force-check-out over them.
- **Create a local branch for the pull request.** It litters the user's
  repository with branches that nothing cleans up. A detached head leaves no
  trace but the worktree.
- **Keep one server per project and let a pull request replace it.** Previewing
  a pull request would then end the owner's own Run. Separate targets let both
  run, each on its own port.
- **Also remove worktrees on API exit.** Exit handlers cannot do asynchronous
  work, and a deep tree takes long enough to delete that the exit would stall.
  Leaving them is safe because the next start refreshes and reuses them.

## Consequences

- **What this makes easier.** A pull request is reviewed running, one click from
  its screen, without touching the clone's checkout.
- **What this makes harder, or what it costs.**
  - A pull request's install scripts and code now run on this machine as this
    user, and a pull request from a stranger is one an owner can start with a
    click. **Accepted risk**, the same shape as ADR-0005 and ADR-0010: the owner
    chooses which pull request to preview, and sees its screen first.
  - Each preview is a full checkout and install on disk until stopped. An
    install is slow the first time.
  - The fetch uses the clone's `origin` remote, so a clone whose `origin` is not
    the project's own GitHub repository cannot fetch it; the preview reports git's
    own message.
  - A project that uses yarn or pnpm is installed with npm.
- **What now has to be true.**
  - Every folder deleted passes both tests above.
  - git is never started through a shell; the only shell line is one of the two
    fixed npm installs.
  - The worktree's folder is built from a validated number and the registry's
    clone, never from a request.
  - Nothing links the clone's files into a worktree.

## Compliance

- `dev-servers-routes.spec.ts` holds the number validation, the write header and
  the loopback guard for the pull form; `hosted-api.spec.ts` ("has no runs, crew
  or dev-server routes") holds the hosted side.
- `pull-worktrees.spec.ts` holds the command sequence, reuse and refresh, the
  failure messages, the pruning, the queue, the removal, and the refusal to touch
  any folder that is not marked as Observatory's; `pull-worktrees-disk.spec.ts`
  holds, on a real disk, that a junction inside a worktree is unlinked and its
  target survives.
- `tool-runner.spec.ts` holds git started without a shell and npm as a fixed
  line; `worktree-files.spec.ts` holds that a link is removed and not followed.
- `dev-servers-pull.spec.ts` holds the keying by target, the phases, the wait for
  the server before the worktree goes, and that exit leaves the worktrees.
- In review: any change to how the worktree path or a command is built must say
  how it keeps the "now has to be true" points above.
