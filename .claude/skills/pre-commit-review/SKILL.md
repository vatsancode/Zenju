---
name: pre-commit-review
description: Run all project checker skills against this session's changes and produce one combined report card. Use at the end of a session, before committing, to verify standards and code quality in one shot.
---

# Pre-Commit Review

The umbrella check. Runs every checker skill against this session's changes
and produces ONE combined report card. This skill has no rules of its own —
it always uses the live rules in each checker's SKILL.md, so refinements
there are picked up automatically.

## Step 1 — Scope (computed once)

Read `.claude/skills/_shared/diff-scope.md` and compute the session's changed
files ONCE. Reuse this list for every checker below — do not recompute.
If the scope is empty, report "No session changes to review." and stop.

## Step 2 — Run the checkers

Read each checker's SKILL.md and apply its rules to the shared scope,
in this order (skip any whose file-type filter matches nothing):

1. `.claude/skills/check-folder-structure/SKILL.md`
2. `.claude/skills/check-security/SKILL.md`
3. `.claude/skills/check-schema-alignment/SKILL.md`
4. `.claude/skills/check-api-routes/SKILL.md`
5. `.claude/skills/check-types/SKILL.md`
6. `.claude/skills/check-performance/SKILL.md`
7. `.claude/skills/check-css-standards/SKILL.md`
8. `.claude/skills/check-ui-consistency/SKILL.md`

(Order = blast radius: structure and security problems first.)

If new `check-*` skills exist in `.claude/skills/` that are not listed above,
run them too, after the listed ones — then remind the user to add them to
this list.

Efficiency note: read each changed file ONCE and evaluate all applicable
rule sets against it — do not re-read files per checker.

## Step 3 — Combined report card

```markdown
# Pre-Commit Review — <date>

**Scope:** <N> changed files on branch <branch>
**Overall verdict:** ✅ READY TO COMMIT | ⚠️ COMMIT WITH CAUTION | ❌ FIX BEFORE COMMIT

| Checker | Verdict | Fails | Warns |
|---|---|---|---|
| folder-structure | ✅ | 0 | 0 |
| security | ❌ | 1 | 2 |
| ... | | | |

## Failures (must fix)
<all ❌ findings from all checkers, in report-format table style>

## Warnings (should fix)
<all ⚠️ findings>
```

**Overall verdict logic:** any ❌ anywhere → FIX BEFORE COMMIT;
only ⚠️ → COMMIT WITH CAUTION; clean → READY TO COMMIT.

After the report, suggest (but do not run unprompted): fixing failures, then
re-running `/pre-commit-review`, and running `/update-docs` if the changes
touched schema, features, or styling conventions.

Report only — do not fix anything unless the user asks.
