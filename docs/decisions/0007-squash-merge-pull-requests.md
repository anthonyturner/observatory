# ADR-0007: Squash-merge pull requests

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** Anthony Turner (maintainer)
- **Related:** [#339](https://github.com/anthonyturner/observatory/issues/339), supersedes the merge-method part of [ADR-0003](0003-agent-autonomy.md), [implementation.md](../agent-workflows/implementation.md)

## Context

[ADR-0003](0003-agent-autonomy.md) required every pull request to land with a
merge commit, never a squash or rebase. Because force-pushing is also ruled
out, a branch that falls behind catches up by merging `main` into it. With a
merge commit, those catch-up merges reach `main` too: in the 40 merges before
this decision, 13 were "merge main into the branch" commits. The commit graph
became a tangle of side paths that the maintainer could not read.

## Decision

We will merge every pull request with a squash merge
(`gh pr merge <n> --squash`). Each pull request becomes one commit on `main`.
Branches still catch up by merging `main`, never by rebasing, but those merges
stay on the branch and do not reach `main`.

The rest of ADR-0003 stands: the posted review is still the gate, and history
is still never rewritten.

## Alternatives considered

- **Keep merge commits and read the graph with `git log --first-parent`.**
  It leaves the history as it is, but every graph view (GitHub, GitLens,
  GitKraken) has to be set up to hide the side paths.
- **Rebase merges.** They give a straight line but replay every work-in-progress
  commit, including the empty "start" commit and the review-fix commits, onto
  `main`.
- **Rebase branches on `main` before merging.** Needs a force-push, which
  [rules.md](../rules.md) forbids.

## Consequences

- **What this makes easier.** `main` reads as one commit per pull request,
  titled after the pull request. Reverting a pull request is still one
  `git revert` of one commit.
- **What this makes harder.** The branch's individual commits are not on
  `main`. They stay on the pull request on GitHub, and on the branch, which is
  never deleted. `git blame` points at the squash commit, not the commit that
  first wrote the line. A merged branch is no longer an ancestor of `main`, so
  "merged" must come from the pull request, never from the commit graph, as
  [implementation.md](../agent-workflows/implementation.md) already requires.
- **What now has to be true.** Every agent merge is a squash merge. A merged
  branch is never built on again: new work starts a new branch from `main`.

## Compliance

Look at `main`: every pull request should appear as one commit with a single
parent, and no "Merge pull request" or "Merge remote-tracking branch" commit
should appear after this decision. An instruction that says to merge with
`--merge` or a merge commit contradicts this ADR and should be corrected.
