# Change diagrams

Read this before any reply, issue or pull request that proposes or reports a
change: a plan, a filed issue, a pull request, a refactor. The reader should
see what changes at a glance, not rebuild it from prose.

## When

| The reply… | Diagram |
| --- | --- |
| answers a question, gives status, or asks something — changes nothing | None. |
| proposes or reports a small change (size XS or S, or unsized and touching a few files) | Inline: ASCII in a terminal chat, which shows Mermaid as raw text; a Mermaid block where it renders (GitHub, most chat apps). |
| plans an issue or opens a pull request of size M or larger | The HTML page below, plus a link to it in the reply. |

The size is the refinement size ([agent-workflows/refinement.md](agent-workflows/refinement.md)).
Skip the diagram when it would show nothing a sentence does not — a typo, a
version bump, a one-line copy change.

## What it shows

One diagram, three things:

- **Before → after.** Two subgraphs, `Before` and `After`, or one graph with
  the changes marked. Leave out what does not change unless it is needed to
  show where the change sits.
- **The parts touched.** Mark them `:::add`, `:::chg` or `:::del` (added,
  changed, removed).
- **How data flows.** Arrows follow the data, labelled where the label carries
  meaning (`-- on miss -->`).

Keep it small: about a dozen nodes, labels of a few words, and under 1.5k
tokens of Mermaid. Prefer `flowchart TB` with `direction LR` inside each
subgraph, and `Before ~~~ After` to stack them, so it stays narrow on a phone.
Name real modules, routes and stores, not "Service A".

## Draw it once

Write the Mermaid once per change and reuse the same text in the reply, the
issue body and the pull-request body; GitHub renders a ` ```mermaid ` block
itself. Redraw only when the change itself changes. A diagram already on the
issue goes into the pull request as-is, or is linked.

## The HTML page

The page is [templates/change-diagram.html](templates/change-diagram.html). It
renders one Mermaid block in light and dark mode at phone width, loading
Mermaid from a CDN; if Mermaid does not load, it shows the text instead.
Never write a page from scratch — that costs thousands of tokens. With the
template you write only the diagram; a host that reads a file before
publishing it adds one read of the template (about 1.5k tokens):

1. Copy the template to the scratchpad or temp directory (a shell `cp`, not a
   read and a write).
2. Replace only the text inside `<script type="text/plain" id="diagram">`. Its
   front matter is read for the `title:` line only, which becomes the page
   heading. `add`, `chg` and `del` are defined for flowcharts already; do not
   repeat them.
3. Publish it as an artifact where the host supports one (for example the
   Claude Code Artifact tool), and put the link in the reply, the issue and the
   pull request. Where there is none, keep the file locally and give its path
   in the reply; a local path means nothing on GitHub, so the issue and the
   pull request carry the Mermaid block instead.

Never commit the page to the project.
