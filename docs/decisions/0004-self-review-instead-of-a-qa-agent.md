# ADR-0004: Self-review instead of a QA agent

- **Status:** Accepted
- **Date:** 2026-09-25
- **Deciders:** Anthony Turner (maintainer)
- **Related:** [ADR-0003](0003-agent-autonomy.md), [qa-review.md](../agent-workflows/qa-review.md), [implementation.md](../agent-workflows/implementation.md)

## Context

The playbook's `merge` autonomy runs a separate QA reviewer on every pull
request before it merges. Observatory is migrated from pr-starmap in many small
pull requests, each 30 to 90 minutes of work, and a separate review pass on
each one costs as much time as the change itself.

## Decision

The implementer reviews its own pull request instead of handing it to a QA
agent. Before merging, it reads its full diff against the issue's acceptance
criteria, [rules.md](../rules.md) and [stack/clean-code.md](../stack/clean-code.md),
fixes what it finds, and posts the result as a pull-request comment: what was
checked, what was verified and how, and anything left undone. Then it merges.

The hard stop "never merge without a posted review" still holds; that comment
is the posted review. A separate QA review (`/agent-playbook:review-pr`) is run
only when the maintainer asks for one.

## Consequences

- Each change merges in minutes, not after a second agent's pass.
- Nobody but the author reads the code before merge, so the self-review
  comment has to be honest about what was not verified.
- If defects start reaching `main`, revisit this decision.
