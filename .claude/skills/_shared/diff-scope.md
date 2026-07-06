# Shared: Session Diff Scope

> Every checker skill uses this to decide WHAT to check.
> Edit this one file to change the scope behaviour of ALL checker skills.

## Rule

Checkers examine **only the current session's changes** — never the whole project.
"Session changes" = uncommitted work (staged + unstaged + untracked) PLUS commits
on the current branch that are not yet on the default branch (master).

## How to collect the changed files

Run these commands from the repo root:

```bash
# 1. Find the merge base with the default branch
BASE=$(git merge-base HEAD origin/master 2>/dev/null || git merge-base HEAD master 2>/dev/null || echo HEAD)

# 2. Committed + staged + unstaged changes vs that base
git diff --name-status "$BASE"

# 3. Brand-new untracked files
git ls-files --others --exclude-standard
```

The union of (2) and (3) is the check scope. Then:

- **Deleted files** (status `D`) — skip; there is nothing to check.
- **Renamed files** — check the new path.
- Filter the list to the file types the invoking skill cares about
  (each skill states its filter).
- If the scope is empty, report: "No session changes to check." and stop.

## Line-level precision

For files that were **modified** (not newly added), prefer judging only the
changed hunks: run `git diff "$BASE" -- <file>` and focus on added/edited lines.
Pre-existing violations in untouched lines may be mentioned as a single FYI note
at the end of the report, but must NOT count toward the verdict — the session is
judged only on what it wrote.

Newly **added** files are checked in full.
