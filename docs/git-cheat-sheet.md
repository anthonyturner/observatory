# Git cheat sheet

A plain-English guide to the Git commands you meet most, for someone who is
still learning. Each command has a one-line explanation, a table saying what
every word and flag means, what happens to your files, and an everyday
comparison to hang it on.

Nothing here runs anything. It only explains, so it is safe to read with a
terminal open beside it. The filter box finds a word anywhere on the page, and
the contents jump to any command.

Three words come up everywhere:

- **Repository.** A project folder together with its full history.
- **Commit.** One saved step in that history, with a message saying what changed.
- **Branch.** A named line of commits. `main` is the shared, finished line;
  you do your own work on a branch of your own.

## Get up to date

How to bring other people's work (and your own work from another machine) into
the branch you are on, and what to do when Git says no.

### The three copies

When you work, there are really three copies of a project in play:

```text
GitHub (origin)         your computer's note        your branch
the shared copy         of GitHub (origin/main)     the files you edit
      |                        ^                          ^
      |   git fetch  ----------+                          |
      |   git merge origin/main --------------------------+
      +-- git pull = both steps in one ------------------>
```

- **GitHub** holds the shared copy. Its nickname in Git is `origin`.
- **`origin/main`** is your computer's saved note of what GitHub's `main`
  looked like the last time you checked. It is a bookmark, and it can be out of
  date until you fetch.
- **Your branch** is the one you are working on, with your files.

**Everyday comparison:** GitHub is the warehouse, `origin/main` is the tracking
page on your phone, and your branch is the desk you actually work at.

### The error Diverging branches can't be fast-forwarded

You see this when you run a pull and Git stops with a hint and then a fatal
line, like this (the hint lists the two ways out, shortened here):

```text
hint: Diverging branches can't be fast-forwarded, you need to either:
hint:
hint:   git merge --no-ff
hint:
hint: or:
hint:
hint:   git rebase
fatal: Not possible to fast-forward, aborting.
```

**In plain English:** both sides moved on. GitHub's `main` has commits you do
not have, and your branch has commits GitHub does not have. They have
_diverged_ (split apart, like a road that forks).

A _fast-forward_ is the easy case: you are only behind, so Git just slides your
branch forward to catch up, like pulling a drawer shut. When you have commits
of your own too, there is nothing to slide, so the two lines have to be
blended with a _merge_. Your Git has been told to allow fast-forwards only
(the setting is `pull.ff = only`, or the command had `--ff-only`), so it
refuses instead of merging.

**How to fix it:**

1. Download what is new: `git fetch origin`. Nothing of yours changes.
2. Look first if you like: `git log --oneline HEAD..origin/main` lists what you
   are missing.
3. Blend it into your branch: `git merge origin/main`. Git makes one merge
   commit that joins the two lines.
4. Or do steps 1 and 3 in one go: `git pull --no-ff --tags origin main`.
5. If Git reports a conflict, see **A merge stops with a conflict** below.

**Everyday comparison:** you and a colleague both edited the same report
while apart. Neither copy is "the" newest, so someone has to put the two
together rather than just replace one with the other.

### Fetch: download what is new

```text
git fetch --tags origin
```

**In one line:** download new commits and tags from GitHub, without changing
your files or your branch.

| Piece    | What it means                                               |
| -------- | ----------------------------------------------------------- |
| `git`    | The program.                                                |
| `fetch`  | Download what is new from another copy. Download only.      |
| `--tags` | Also fetch tags: named labels on commits, such as `v1.2.0`. |
| `origin` | The nickname for the copy on GitHub.                        |

**What happens to your files:** nothing. Your files and your branch stay
exactly as they were. Only `origin/main` (your computer's note of GitHub)
moves forward. That makes `fetch` safe to run any time.

**Everyday comparison:** fetch is the parcel arriving on your porch. It is
here, you know what is in it, and you have not opened it yet.

### Look before you merge

```text
git log --oneline HEAD..origin/main
```

**In one line:** list the commits that GitHub's `main` has and your branch does
not, one per line.

| Piece         | What it means                                               |
| ------------- | ----------------------------------------------------------- |
| `git log`     | Show the history of commits, newest first.                  |
| `--oneline`   | One short line per commit: a short id and the message.      |
| `HEAD`        | Where you are right now: the commit your branch points at.  |
| `..`          | "In the right-hand side but not the left-hand side."        |
| `origin/main` | Your computer's note of GitHub's `main` (fetch updates it). |

**What happens to your files:** nothing. It only reads and prints.

If it prints nothing, there is nothing new to bring in. To see the opposite (what
you have that GitHub lacks), swap the two sides: `git log --oneline origin/main..HEAD`.
Run `git fetch origin` first, because the command reads your note of GitHub, not
GitHub itself.

**Everyday comparison:** reading the delivery note before you open the parcel.

### Pull: fetch and merge

```text
git pull
```

**In one line:** fetch, then merge what arrived into the branch you are on.

| Piece  | What it means                                |
| ------ | -------------------------------------------- |
| `git`  | The program.                                 |
| `pull` | A fetch followed by a merge, as one command. |

**What happens to your files:** they change. If you are only behind, your
branch slides forward and new work appears in your files. If both sides moved,
Git makes a merge commit, or stops with the "Diverging branches" error above
when it is set to fast-forward only. On a conflict, it stops and asks you to
fix it.

**Everyday comparison:** pull is the parcel arriving and you unpacking it at
once.

### Fast-forward only: catch up without a merge

```text
git pull --ff-only origin main
```

**In one line:** bring in GitHub's `main` only if you are simply behind, so no
merge commit is ever made.

| Piece                          | What it means                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `git pull`                     | Fetch, then bring the new work in.                                                       |
| `--ff-only`                    | "Fast-forward only": slide your branch forward if you are only behind; otherwise refuse. |
| `origin`                       | The nickname for GitHub.                                                                 |
| `main`                         | The branch to bring in.                                                                  |
| `git merge --ff-only <branch>` | The same rule for work you already fetched, such as `git merge --ff-only origin/main`.   |

**What happens to your files:** if you are only behind, your branch moves
forward to match GitHub and the new work appears in your files, with no extra
commit. If you have commits of your own too, Git changes nothing and stops with
the "Diverging branches" error above; then merge instead.

This is the safe way to update your own copy of `main`, where you should never
have commits of your own.

**Everyday comparison:** pulling a drawer shut. It only works if nothing is in
the way; if something is, you stop and look rather than force it.

### Pull when both sides moved

```text
git pull --no-ff --tags origin main
```

**In one line:** bring GitHub's `main` into your branch even when both have
moved on, allowing a merge commit.

| Piece      | What it means                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git pull` | Fetch, then merge.                                                                                                                                               |
| `--no-ff`  | "No fast-forward": always make a merge commit, even when a fast-forward would do. It overrides a fast-forward-only setting, so this works when both sides moved. |
| `--tags`   | Also fetch tags (named labels on commits).                                                                                                                       |
| `origin`   | The nickname for GitHub.                                                                                                                                         |
| `main`     | The branch to bring in.                                                                                                                                          |

**What happens to your files:** your branch gets GitHub's new `main` work
blended in, and your own work is kept. Git records a merge commit. If the same
lines were changed on both sides, it pauses with a conflict for you to fix.

Note that `main` here is GitHub's `main`, merged into whichever branch you are
standing on. Check with `git status` which branch that is.

If your Git is set to rebase on pull (`pull.rebase = true`), `--no-ff` alone
does not make it merge: add `--no-rebase`, as in
`git pull --no-rebase --no-ff --tags origin main`. Otherwise it rewrites your
commits on top of GitHub's instead, and a conflict then needs
`git rebase --abort` rather than `git merge --abort`.

**Everyday comparison:** you unpack the parcel and fit the new things in among
your own, even though your shelf was not empty.

### Merge: blend in what you already downloaded

```text
git merge origin/main
```

**In one line:** blend the already-downloaded `main` into the branch you are on.

| Piece         | What it means                                                                           |
| ------------- | --------------------------------------------------------------------------------------- |
| `git merge`   | Join another line of commits into the one you are on.                                   |
| `origin/main` | Your computer's note of GitHub's `main`. Run `git fetch origin` first so it is current. |

**What happens to your files:** your branch gains the other line's changes.
When both sides moved, Git adds one merge commit. If the same lines were changed
on both sides, it stops for you to settle them. The other line (`origin/main`)
is not changed.

**Everyday comparison:** fetch was the parcel arriving; merge is unpacking it
and putting the things away.

## When a merge goes wrong

### A merge stops with a conflict

A _conflict_ means both sides changed the same lines and Git cannot guess which
to keep. It stops halfway and waits for you. Nothing is lost.

```text
git status
# fix each file listed under "both modified"
git add <file>
git commit
```

| Piece            | What it means                                                                         |
| ---------------- | ------------------------------------------------------------------------------------- |
| `git status`     | Lists the files still in conflict.                                                    |
| `<file>`         | The path of a file you have fixed. Replace it with the real name.                     |
| `git add <file>` | Tell Git "this file is settled now".                                                  |
| `git commit`     | Finish the merge. Git opens its message with a ready-made default; save and close it. |

To fix a file, open it and look for the markers Git left:

```text
<<<<<<< HEAD
your version of the lines
=======
the other side's version of the lines
>>>>>>> origin/main
```

Keep what you want (yours, theirs, or a mix), delete all three marker lines,
save, then `git add` the file.

**What happens to your files:** the conflicted files hold both versions until
you edit them. Files without a conflict are already merged.

**Everyday comparison:** two people rewrote the same sentence. Git cannot pick
the better one, so it hands you both on one sheet and you write the final line.

### Merge --abort: back out of a merge

```text
git merge --abort
```

**In one line:** cancel a merge that stopped on a conflict and go back to how
things were before it started.

| Piece       | What it means                        |
| ----------- | ------------------------------------ |
| `git merge` | The merge command.                   |
| `--abort`   | Stop and undo the merge in progress. |

**What happens to your files:** your branch and files return to the state
before you ran the merge. It only works while a merge is still unfinished. Keep
your own edits committed (or set aside) before you merge, so there is nothing
unsaved for an abort to disturb.

**Everyday comparison:** you started unpacking and it is a mess, so you put
everything back in the box and close the lid.

## Everyday basics

### Status: what is going on

```text
git status
```

**In one line:** show your branch and which files are changed, staged (picked
for the next commit) or untracked (new to Git).

| Piece        | What it means                                               |
| ------------ | ----------------------------------------------------------- |
| `git status` | Print the state of your working folder. It changes nothing. |

**What happens to your files:** nothing.

**Everyday comparison:** a glance at the dashboard before you set off.

### Diff: what did I change

```text
git diff
```

**In one line:** show the exact lines you have changed but not yet staged.

| Piece               | What it means                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git diff`          | Print the lines you changed since you last staged (or since the last commit, if nothing is staged). Lines starting with `-` were removed and `+` were added. |
| `git diff --staged` | The same, but for what is staged and about to be committed.                                                                                                  |

**What happens to your files:** nothing. It only prints.

**Everyday comparison:** the tracked-changes view in a document.

### Add: pick what goes in the next commit

```text
git add <file>
```

**In one line:** stage a file, meaning mark its current state as part of the
next commit.

| Piece     | What it means                                                 |
| --------- | ------------------------------------------------------------- |
| `git add` | Put changes on the "to be committed" list (the staging area). |
| `<file>`  | The path of the file to stage. Replace it with the real name. |

**What happens to your files:** nothing changes in the file itself. Git only
notes that it is ready. Naming files one by one stops you from committing
something by accident, such as a secret or a leftover test file.

**Everyday comparison:** putting items in the shopping basket before you go to
the till.

### Commit: save a step

```text
git commit -m "Say what changed"
```

**In one line:** save the staged changes as a new step in the history, with a
message.

| Piece                | What it means                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `git commit`         | Record the staged changes as a commit.                                                                                                       |
| `-m`                 | "Message": the next piece of text is the commit message.                                                                                     |
| `"Say what changed"` | Your message, in quotes. Write what changed and why.                                                                                         |
| `git commit -am "…"` | Stage every changed file Git already tracks, then commit, in one go. New files are left out, and so is the check of what you are committing. |

**What happens to your files:** nothing visible. The commit stays on your
computer until you push.

**Everyday comparison:** paying at the till. The basket is now a receipt in the
history.

### Push: share your commits

```text
git push
```

**In one line:** send your new commits on this branch to GitHub.

| Piece                         | What it means                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `git push`                    | Upload your commits to the branch's copy on GitHub.                                             |
| `git push -u origin <branch>` | The first time for a new branch: `-u` remembers the link so a bare `git push` works afterwards. |

**What happens to your files:** nothing on your computer. GitHub's copy of
your branch gains your commits. Git refuses if GitHub has commits you lack: pull
or merge first. Do not reach for a forced push (see **Danger zone**).

**Everyday comparison:** posting the parcel.

### Log: the history

```text
git log --oneline
```

**In one line:** list recent commits, newest first, one per line.

| Piece       | What it means                                                        |
| ----------- | -------------------------------------------------------------------- |
| `git log`   | Show the commit history.                                             |
| `--oneline` | Short form: a short id and the message. Press `q` to leave the list. |

**What happens to your files:** nothing.

**Everyday comparison:** flicking back through a diary.

## Branches

### Branch: list your branches

```text
git branch
```

**In one line:** list the branches on your computer; the one you are on is marked
with an asterisk (`*`).

| Piece        | What it means                            |
| ------------ | ---------------------------------------- |
| `git branch` | List local branches. It changes nothing. |

**What happens to your files:** nothing.

**Everyday comparison:** the list of drafts in a folder, with the open one
marked.

### Switch: move to another branch

```text
git switch <name>
```

**In one line:** change which branch you are working on.

| Piece        | What it means                                       |
| ------------ | --------------------------------------------------- |
| `git switch` | Move to a different branch.                         |
| `<name>`     | The branch to go to. Replace it with the real name. |

**What happens to your files:** they change to match that branch. Unsaved edits
that do not clash come with you. If they would be overwritten, Git refuses
rather than lose them: commit first, then switch.

**Everyday comparison:** opening a different draft of the same document.

### Switch -c: start a new branch

```text
git switch -c <new>
```

**In one line:** make a new branch from where you are now, and move onto it.

| Piece        | What it means                                              |
| ------------ | ---------------------------------------------------------- |
| `git switch` | Move to a branch.                                          |
| `-c`         | "Create": make the branch first.                           |
| `<new>`      | The name of the new branch. Replace it with the real name. |

**What happens to your files:** nothing changes. The new branch starts at your
current commit, so your files are the same until you edit them.

**Everyday comparison:** photocopying a draft so you can try ideas without
touching the original.

## Undo safely

### Restore: drop edits to one file

```text
git restore <file>
```

**In one line:** throw away your unsaved edits to one file and put it back as
it was when last staged or committed.

| Piece         | What it means                                        |
| ------------- | ---------------------------------------------------- |
| `git restore` | Put a file back to a saved state.                    |
| `<file>`      | The path of the file. Replace it with the real name. |

**What happens to your files:** that one file loses the edits you have not
committed. **This cannot be undone**, because Git never saved those edits. Look
at `git diff <file>` first if you are not sure.

**Everyday comparison:** crumpling up your latest scribbles and going back to
the clean page.

### Restore --staged: take a file off the list

```text
git restore --staged <file>
```

**In one line:** unstage a file, so it is no longer in the next commit.

| Piece         | What it means                                               |
| ------------- | ----------------------------------------------------------- |
| `git restore` | Put something back.                                         |
| `--staged`    | Act on the staging area (the basket), not the file on disk. |
| `<file>`      | The path of the file. Replace it with the real name.        |

**What happens to your files:** nothing is lost. Your edits stay in the file;
it is just no longer picked for the next commit.

**Everyday comparison:** taking an item back out of the shopping basket and
leaving it on the shelf.

## Worktrees

A _worktree_ is an extra folder with its own branch checked out, sharing the
same history. It lets you, or a helper, work on two branches at once without
switching back and forth. This project uses them for exactly that.

### Worktree list: see every folder

```text
git worktree list
```

**In one line:** list every worktree for this repository, with the branch each
one has open.

| Piece          | What it means                                         |
| -------------- | ----------------------------------------------------- |
| `git worktree` | The commands for extra working folders.               |
| `list`         | Print each folder, its current commit and its branch. |

**What happens to your files:** nothing.

**Everyday comparison:** a list of all the desks, with the job on each.

### Worktree add: open a new folder

```text
git worktree add <folder> -b <new-branch> origin/main
```

**In one line:** create a new folder with a new branch, starting from GitHub's
`main`.

| Piece              | What it means                                              |
| ------------------ | ---------------------------------------------------------- |
| `git worktree add` | Make a new worktree.                                       |
| `<folder>`         | Where to put it. Replace it with a real path.              |
| `-b <new-branch>`  | Create a branch with this name and open it there.          |
| `origin/main`      | Where the new branch starts: your note of GitHub's `main`. |

**What happens to your files:** the folder you are in is untouched. A fresh
checkout appears in the new folder. Install the project's dependencies in it
before building.

**Everyday comparison:** pulling up a second desk so a half-finished job on the
first one is left alone.

### The stash is shared

`git stash` parks your uncommitted edits on a shelf. In a project with
worktrees, **that shelf is shared by every worktree**. Edits you stash in one
folder can turn up as the "latest" stash in another, and popping the wrong one
puts them in the wrong place.

**Prefer a work-in-progress commit** on your own branch:

```text
git add <file>
git commit -m "wip: half-done, saving my place"
```

It is labelled, it belongs to your branch, and it is safe on your computer.
This project squash-merges (it folds a branch's commits into one), so wip
commits do not end up in `main`'s history.

**Everyday comparison:** a shared lost-property box that everyone in the house
uses, versus a labelled drawer of your own.

## Danger zone

These rewrite history or throw work away, and some cannot be undone. Learn what
they do so you can recognise them, but do not run them to get unstuck. **In
this project, agents never do any of these**; if one looks necessary, stop and
ask.

### Force-push: overwrite GitHub

```text
git push --force
```

| Piece                | What it means                                                  |
| -------------------- | -------------------------------------------------------------- |
| `git push`           | Upload your commits to GitHub.                                 |
| `--force`            | Replace GitHub's branch with yours, whatever it held.          |
| `--force-with-lease` | The same, but refuse if someone pushed since you last fetched. |

Replaces GitHub's copy of a branch with yours, even if that deletes commits
other people have. `--force-with-lease` is a little safer (it refuses if
someone pushed since you last looked) but still rewrites history. Never on
`main`.

### Reset --hard: throw away work

```text
git reset --hard <commit>
```

| Piece       | What it means                                                        |
| ----------- | -------------------------------------------------------------------- |
| `git reset` | Move your branch to another commit.                                  |
| `--hard`    | Also overwrite your files to match it, discarding uncommitted edits. |
| `<commit>`  | Where to move to: a commit id, or a name such as `origin/main`.      |

Moves your branch to `<commit>` and **discards every uncommitted edit** in your
files. The edits are not recoverable. Committed work can often be found again
(see below).

### Delete a branch

```text
git branch -D <name>
git push origin --delete <name>
```

| Piece             | What it means                                                 |
| ----------------- | ------------------------------------------------------------- |
| `git branch -D`   | Delete a local branch, even if its work was never merged.     |
| `-d`              | The safe lowercase form: refuses when the work is not merged. |
| `git push origin` | Talk to GitHub.                                               |
| `--delete`        | Remove the named branch there instead of uploading to it.     |
| `<name>`          | The branch. Replace it with the real name.                    |

The first removes a branch from your computer even if its work was never
merged; the lowercase `-d` refuses to do that. The second deletes it on
GitHub. Commits only that branch had can become hard to find.

### Clean: delete untracked files

```text
git clean -fd
```

| Piece       | What it means                                                  |
| ----------- | -------------------------------------------------------------- |
| `git clean` | Delete files Git is not tracking.                              |
| `-f`        | "Force": really delete. Git refuses to clean without it.       |
| `-d`        | Include untracked folders, not only files.                     |
| `-n`        | "Dry run": list what would go, deleting nothing. Use it first. |

Deletes files and folders Git is not tracking (`-f` force, `-d` include
folders). They were never saved, so they are gone for good. Add `-n` to
preview what it would delete without deleting anything.

### Rewriting history

`git rebase` and `git commit --amend` rewrite commits that already exist. That
is harmless on commits only you have, and harmful once they are pushed and
others build on them.

### If something looks lost

```text
git reflog
```

| Piece        | What it means                                             |
| ------------ | --------------------------------------------------------- |
| `git reflog` | List every place `HEAD` has been, newest first, with ids. |

`git reflog` lists where `HEAD` (where you are) has been, even through resets
and branch changes, so a committed piece of work can often be found by its id
and brought back with `git switch -c <name> <id>`. It cannot bring back edits
that were never committed.
