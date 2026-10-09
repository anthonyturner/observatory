# Design principles

Read this before you design or change any code. The goal is less complexity,
not just working code. Based on John Ousterhout's *A Philosophy of Software
Design*.

## 1. Program strategically, never tactically

This rule outranks the rest of this file.

- **Tactical** means the smallest diff that makes it work: a special case, a
  shortcut, a reach into another module's internals, a "clean it up later".
  Each one looks harmless. Hundreds of them make spaghetti, and no single fix
  can undo it. **Do not program this way.**
- **Strategic** means working code is the minimum, not the goal. The goal is a
  design that keeps the next change cheap. Spend a little more time now
  (roughly 10–20%) to get it.

On every change:

1. Aim for the code you would have written if you had built the system from
   scratch, knowing what you know now. Get as close as the change allows.
2. Leave the code you touch better than you found it. A change usually makes
   something a little worse, so you have to improve something just to break
   even.
3. Pick the clean interface over the fewest changed lines. Fear of breaking
   something is a reason to write a test, not to hack around the code.
4. Allow zero small kludges. Each one is how the slide into tactical
   programming starts.
5. Take small steps, not heroics. Design the interface before you code a new
   module, then improve it as you learn.

When the clean fix is bigger than the issue, do the clean part that is in
scope. File the rest as a follow-up issue and name it in the pull request.
Never leave a hack in silently.

## 2. Make modules deep

- A deep module has a simple interface over a lot of hidden work. Its
  interface is everything a caller must know: signatures, side effects,
  ordering and dependencies.
- Avoid shallow modules: pass-through methods and thin wrappers that cost more
  to learn than they hide.
- Avoid *classitis*: many tiny classes or layers that each add a sliver.
  Prefer fewer, meatier ones.
- Measure depth, not length. Never split a function just because it is long.
  Split it when the pieces are each simpler to understand.
- Make the common case trivial for the caller. Rare cases take options.
- A slightly general-purpose interface is often simpler and deeper than one
  shaped around its single caller.

## 3. Define errors out of existence

- Prefer semantics in which the error cannot happen. Deleting something that
  is already gone succeeds. An out-of-range slice returns the overlap.
- Throw only when you truly cannot keep the contract, such as a failed read.
  Throwing more is not "more defensive".
- Handle each error in as few places as possible. Let it travel to where it
  can actually be dealt with, not be caught and re-thrown at every layer.
- Defining an error away is not ignoring it. Never swallow an error that
  matters.

## 4. Design it twice

Your first idea is rarely your best. Before you build, sketch at least one
other way to do it, compare the two, and keep the better one. It costs
roughly 1–2% of the build time and often pays back far more.

- **Make them genuinely different.** Two spellings of one idea do not count.
  Ask: "if I were not allowed to build my first idea, what would I build?"
- **Stay at the interface level.** Sketch what callers would see and do:
  signatures, ownership, data flow. This is a few lines each, not a second
  implementation.
- **Think from the caller's side.** Judge each sketch by how simple it makes
  the code that uses it, not by how easy it is to write.
- **Even a deliberately bad alternative teaches something.** Comparing
  against it shows why the winner wins, and sometimes the "bad" one turns out
  simpler, or the best design combines the two.
- **Record why the loser lost**, in a sentence or two, so the next reader
  does not reopen the question.
- **Keep it cheap.** Two or three options, compared once. This is not
  analysis paralysis (endless weighing that never decides). When a change
  truly has only one sensible shape, such as a typo fix, say so and why.

Every filed issue records this in its **Alternatives considered** section;
the format is in **Issue format** in
[agent-workflows/product-manager.md](agent-workflows/product-manager.md).

## Red flags

If you see one of these in your diff, stop and redesign:

- a special-case `if` added to make one scenario work;
- a reach into another module's internals or global state to avoid
  designing an interface;
- a method that only forwards to another method;
- a function split up for length alone;
- a `catch` that discards the error;
- a "TODO: clean up later" with no follow-up issue.

## How this fits the rules

- Improve only the code your change touches. Leave unrelated files alone
  ([rule 7](rules.md)).
- "Deep" is not "more abstract". Never add a layer or interface that hides
  nothing ([rule 9](rules.md)).
- Every pull request names the principles it applied in a short **Design**
  note; the format is step 9 of **Implement and verify** in
  [agent-workflows/implementation.md](agent-workflows/implementation.md).
- In review, a tactical shortcut is a finding, with the same weight as a bug.
  So is a missing or token alternative (a straw man named only to fill the
  section, with no real reason it lost).
