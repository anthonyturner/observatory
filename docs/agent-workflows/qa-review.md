# QA and pull-request review workflow

Use this read-only workflow to review a pull request against its linked issue
and the repository's standards.

Write the review for the requester, following the response formatting and
audience rules in [../response-style.md](../response-style.md): plain English
first, technical detail underneath, jargon explained the first time it appears,
and file and line references kept as evidence.

## Process

1. Read `AGENTS.md`, [../rules.md](../rules.md), [tracking.md](tracking.md),
   the files under `docs/stack/` that apply, the pull-request title and body,
   commits, checks, changed files, the full diff, the linked GitHub issue and
   its comments, and any design comment. Acceptance criteria must be read from
   the issue; flag any divergence between the issue and the pull request as a
   blocking finding rather than picking the version that suits the diff.
2. Evaluate every acceptance criterion using evidence from the diff and checks.
3. Review correctness, scope, the stack rules, test coverage of new logic,
   commit format, PR linkage, secrets, debug artifacts, comments
   ([rule 15](../rules.md)), tactical shortcuts, a missing or token
   alternative on the issue or pull request
   ([../design-principles.md](../design-principles.md), **Design it twice**),
   and the `CHANGELOG.md` entry
   ([../changelog.md](../changelog.md)) as applicable. A user-visible change
   with no entry, and no reason given for leaving it out, is a finding.
4. Do not claim a build or test passed without evidence. Mark behavior that
   requires manual testing in the running app.
5. Report blocking findings first with file and line references. Separate
   non-blocking suggestions and manual-verification items.
6. Give a verdict: **approve** only when no blocking finding remains and
   automated evidence is sufficient; otherwise **request changes**.
7. Report **escalation signals** when they occur, as defined in
   [refinement.md](refinement.md): you could not reach a verdict from the
   available evidence, the change is correct in a way you cannot explain, or
   the diff is large enough that you are confident about some files and not
   others. Name the files you are not confident about. "I reviewed it and it
   looks fine" over a diff you could not fully hold is the failure to avoid.
8. Verify the tracking linkage itself: the body carries `Closes #<n>`, and
   the branch is named `<type>/<issue-number>-<short-description>`. A missing
   link is a real finding — without it the merge leaves the issue open.
9. Post the review on the pull request as a comment (`gh pr review <n>
   --comment` or `gh pr comment <n>`). GitHub does not let an account approve
   its own pull request, so the verdict is stated in the comment rather than
   submitted as an approval. Never close the issue — a review verdict is not a
   state change, and closure follows the merge.

The review itself is read-only: do not edit files, commit, push, merge, close
an issue, or broaden the pull request's scope while reviewing. Fixing the
findings and merging are the engineer's next steps, in **Review and merge** in
[implementation.md](implementation.md), and they start only after the review is
posted.

## The second draft

A review that makes the engineer change something has taught something. Once
the fixes are in, the engineer records the lesson in a `## Second draft`
section of the comment that reports the fixes (the re-review comment that
**Review and merge** in [implementation.md](implementation.md) already
requires, or a comment of its own). Observatory's Journal screen reads these
sections from the pull request's comments and lists them over time, so GitHub
stays the one record.

Write only what really happened. A review that changed nothing has no second
draft: leave the section out rather than writing "none". Never write one for a
pull request after the fact.

```markdown
## Second draft

- **First version:** What was built before the review, in a sentence or two.
- **Feedback:** What the review found, in a sentence or two.
- **Changed and why:** What changed on the redo, and the reason.
- **Principles:** deep-modules, design-it-twice
```

The parser (`server/journal/second-draft.ts`) reads it like this:

- The section runs from a heading whose text starts with "Second draft" (any
  heading level) to the next heading of the same or a higher level.
- Each field is a line starting with its label and a colon, case and bold
  ignored: `First version`, `Feedback`, `Changed and why` (`Changed` also
  works) and `Principles`. Text on the lines after a label belongs to it.
- Text inside a fenced code block is skipped, so a review can quote the format
  without recording a lesson.
- One `First version` line starts one entry, so a review that taught several
  lessons repeats the four fields for each.
- An entry missing its first version, feedback or change is left out of the
  Journal; nothing else breaks.
- `Principles` lists ids from `PRINCIPLES` in `server/principles/principles.ts`
  (for example `deep-modules`, `design-it-twice`, `errors-out-of-existence`),
  separated by commas or spaces. Use the id, never the title or a copy of the
  wording: the Journal shows the title from that list. A word that is not an id
  is ignored, and an entry naming no id is still listed, without a chip.
