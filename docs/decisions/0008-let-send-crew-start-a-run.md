# ADR-0008: Let Send crew start a run from instructions the server writes

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Anthony Turner (maintainer), in issue #431
- **Related:** [#431](https://github.com/anthonyturner/observatory/issues/431), [#445](https://github.com/anthonyturner/observatory/pull/445); supersedes one point of [ADR-0005](0005-run-tier-3-tasks-on-the-local-site-only.md), "Nothing on the page starts a run except Run itself, pressed by the owner"

## Context

ADR-0005 lets the local API run Claude Code, but only after the owner confirms
a proposal. It also holds that nothing on the page starts a run except the
proposal card's Run button. Issue #431 asks for **Send crew** on a conflicted
or failing pull request in the Review Queue: one press, and a run brings the
branch up to date or fixes its checks, then pushes to the pull request's
branch. That press is a second way for the page to start a run, so the old
point no longer holds as written.

## Decision

We will let the Review Queue's **Send crew** button start a run, on these
terms:

- **The server writes the words.** `POST /api/crew { repo, number }`
  (`server/crew/`) reads the queue afresh. It refuses a pull request that is
  not conflicted or failing, and a branch name outside a safe pattern. It then
  builds the prompt itself and asks `Runner.offer` for a proposal token. The
  page sends only a repository and a number, never words of its own.
- **The gate is unchanged.** The page starts the run with the same
  `POST /api/runs` and token as Run does. Every ADR-0005 limit still applies:
  single use, five minutes, the folder checked twice, one run at a time, 30
  minutes, cancel, and no permission flags.
- **The owner presses it.** Send crew is a button the owner presses on a
  pull request's card or screen. Nothing starts a crew on its own.
- **The crew never force-pushes or merges.** Its instructions keep the
  owner's checkout untouched (it works in a temporary worktree). A conflict is
  fixed by merging the base in, not by a rebase, which would need a
  force-push. It pushes only to the pull request's own branch.

ADR-0005's point becomes: nothing on the page starts a run except **Run** or
**Send crew**, pressed by the owner.

## Alternatives considered

- **Show the crew as a proposal card with a Run button.** This keeps
  ADR-0005's wording, but needs a second press for a prompt the owner did not
  write and cannot change. The extra press protects nothing the server's own
  checks don't already.
- **Let the page send the prompt.** Any local caller could then use
  `/api/crew` to run arbitrary words without the proposal card. Rejected: the
  server writes it.
- **A separate spawner for crews.** It would duplicate the runner, its limits
  and its kill logic (rule 10).
- **Rebase onto the base.** It needs a force-push, which the project's rules
  forbid.

## Consequences

- **What this makes easier.** A stuck pull request can be cleared from the
  sky in one press, with its progress on the star and its log in Home's task
  panel.
- **What this makes harder, or what it costs.**
  - A second page path starts a run, so a change to either path must keep
    both within the gate.
  - A crew's run is marked only by its prompt's first line
    (`CREW_TAG` in `server/crew/crew-prompt.ts`, read by
    `src/app/core/crew/crew-tag.ts`). The two must change together.
  - A crew's merge commit stays on the branch. Squash merges
    ([ADR-0007](0007-squash-merge-pull-requests.md)) keep it out of `main`'s
    history.
  - A crew costs the owner's Claude usage, and holds the runner for up to 30
    minutes.
- **What now has to be true.**
  - `/api/crew` exists on the local server only, and never accepts prompt
    text from the request.
  - A crew starts only through `POST /api/runs` with a token from
    `Runner.offer`.
  - The crew prompt forbids force-pushing, merging or closing the pull
    request, and pushing to any other branch.

## Compliance

- `grep -rn "withCrewRoutes" server api --include=*.ts` finds it only in
  `server/main.ts` and tests. `hosted-api.spec.ts` asserts `/api/crew`
  answers 404.
- `crew-routes.spec.ts` covers the refusals: a pull request not stuck, an
  unsafe branch, a bad body, a missing write header. `crew-prompt.spec.ts`
  checks the prompt's rules.
- In review: `propose` in `crew-routes.ts` reads only `repo` and `number`
  from the body.
