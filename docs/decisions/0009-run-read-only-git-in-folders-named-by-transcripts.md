# ADR-0009: Run read-only git in folders named by session transcripts

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Anthony Turner (owner), via the refinement on #489
- **Related:** [#489](https://github.com/anthonyturner/observatory/issues/489), [#492](https://github.com/anthonyturner/observatory/issues/492), [ADR-0005](0005-run-tier-3-tasks-on-the-local-site-only.md)

## Context

An agent's page has a Changes tab that shows the code the agent is changing
while it works. The transcript cannot supply this. An agent edits files
through Bash as often as through the Edit tool, and a Bash edit leaves no file
contents in the transcript. Only git can say what changed in the folder.

So the local API now starts git processes in folders on the owner's machine.
That is new. Until now the server ran git only in clones it found for the
collision check (`server/collisions/pair-merger.ts`), and nothing outside
the server picked the folder. Here the folder comes from a Claude Code
transcript (its `cwd` lines). It belongs to a working tree that a live agent
may be committing in at that very moment.

## Decision

We will run git only from the local API (`server/main.ts`), never the hosted
one, and only in a folder read from the agent's own transcript, never one
named by the request. The route accepts a session id and a subagent id, and
answers 400 to any other query key (`server/live-agents/changes-routes.ts`).

Every call goes through one runner, `readOnlyGit`
(`server/live-agents/read-only-git.ts`), which:

- runs `git` with `execFile`, never through a shell;
- passes `--no-optional-locks` and `core.fsmonitor=false`, so a read never
  takes `index.lock` from the agent and never starts a daemon in its folder;
- sets `GIT_TERMINAL_PROMPT=0` and a timeout, so a call fails rather than
  waits;
- returns exit codes and leaves stderr unread, since autocrlf warnings land
  there;
- runs only `rev-parse`, `symbolic-ref`, `merge-base`, `diff` and `ls-files`,
  and never `fetch`. The comparison is against `origin/main` as of the last
  fetch, and the page says so.

Untracked files are listed with one `ls-files` call and turned into diffs by
the server, which reads them from disk. File names never reach git.

## Alternatives considered

- **Take the folder from the request.** This is simpler for the page, but any
  page that can reach the API could then point git at any folder. Rejected.
- **Build the diff from the transcript's Edit and Write calls.** This misses
  every change made through Bash, which is often most of them. Rejected.
- **Diff against a temporary index (`GIT_INDEX_FILE` and `add -N`).** This
  covers untracked files in one git call, but it writes objects into a
  repository a live agent is using. Rejected.
- **One `git diff --no-index -- /dev/null <file>` per untracked file.** This
  is what the refinement proposed, and it works on Git for Windows. But each
  git process takes about 200 ms to start there, so 200 new files took 47 s
  when measured. Rejected for speed. `new-file-diff.spec.ts` runs git's own
  `--no-index` output against the server's for a range of files and requires
  the two to match. If they ever differ, that spec fails.
- **Fetch before comparing, for a fresher base.** This is a network call and
  a write into the agent's repository on every refresh. Rejected. A stale
  `origin/main` can widen the diff, and the page states which base it used.

## Consequences

- **Easier:** any change, however it was made, shows on the agent's page
  within seconds, with no work from the agent.
- **Harder:** a folder is not an agent. A session working in the shared
  primary checkout shows other sessions' uncommitted work too, so the page
  has to warn when the folder is a primary checkout on its default branch.
  The diff of an untracked file comes from the server, not from git. Its
  output must keep matching git's, and a CRLF file shows its `\r` because
  autocrlf is not applied.
- **Now has to be true:** the git route stays off the hosted API. Every git
  call goes through `readOnlyGit` and runs only read-only subcommands. A
  folder comes only from a transcript. Any path given to git goes after `--`.

## Compliance

- `agent-changes.spec.ts` records every git call against real temporary
  repositories. It fails on any subcommand outside the read-only set, and on
  any `diff` call that does not end its options with `--`.
- `changes-routes.spec.ts` checks that a request naming a folder gets a 400
  before anything is read.
- `hosted-api.spec.ts` and `hosted-imports.spec.ts` keep `live-agents/` off
  the hosted site.
- In review: a new `execFile('git', …)` outside `readOnlyGit`, or a git
  subcommand that writes, breaks this decision.
