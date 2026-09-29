# ADR-0006: Keep the assistant on the local site only

- **Status:** Accepted
- **Date:** 2026-09-27
- **Deciders:** Anthony Turner (maintainer)
- **Related:** [#148](https://github.com/anthonyturner/observatory/issues/148) (Jev as an agent), [ADR-0005](0005-run-tier-3-tasks-on-the-local-site-only.md) (the runner)

## Context

Jev became a conversational agent (#148): a model with tools that read the
owner's projects, pull requests, issues and usage, search the web, and propose
Claude Code tasks in the owner's repositories. The hosted site on Vercel is on
the internet, holds a GitHub token that can read every private repository, and
until now served Jev and the ElevenLabs voice to the signed-in owner (visitors
were refused). An agent reachable from the internet is a way in: a stolen
session cookie, a flaw in sign-in, or a prompt planted in an issue or a pull
request's title could steer it to read and repeat what it can see, and every
call spends the owner's credit.

## Decision

The assistant exists **only on the local site**:

- The hosted API has no `/api/route`, `/api/voice` or `/api/voice/speak`,
  for anyone, the owner included; they answer 404. Its configuration no longer
  reads `OPENROUTER_API_KEY`, `ELEVENLABS_OBSERVATORY_KEY` or
  `ELEVENLABS_VOICE_ID`, so a key set on Vercel by mistake changes nothing.
- On the hosted site, Home shows one line in place of Ask, voice and skills;
  the page hides them when the session is not local, or when the API answers
  that there is no assistant.
- Locally nothing changes: the API listens on loopback only, and the routes
  that run code or spend credit refuse any page but this machine's own
  (`http/loopback-guard.ts`).

## Consequences

- There is no way to talk to Jev, or to have an AI agent read the projects,
  from the internet; the hosted site is a read-only chart again, as it was
  before the assistant.
- The owner cannot use Jev or the ElevenLabs voice away from their machine.
  Bringing it back would need its own decision: at least a second factor for
  the owner and tools that cannot reach private data.
- The hosted wording in the assistant (a command quoted for both shells, the
  hosted Jev-off note) is no longer reachable and is left to be tidied as it is
  next touched.
