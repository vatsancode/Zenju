# Zenju Project Skills — Quality Gate System

Custom Claude Code skills that check **this session's changes only** (never the
whole project) against the project's standards. Rule sources: `PRD.md`,
`STYLEGUIDE.md`, `SCHEMA_CONCLUSION.md`.

## The skills

| Skill | What it checks |
|---|---|
| `/check-folder-structure` | New files in the right folder, logic at the right layer |
| `/check-css-standards` | STYLEGUIDE.md rules — no Tailwind, tokens only, globals vs module split |
| `/check-performance` | O(n²) loops, N+1 queries, over-fetching, render waste |
| `/check-schema-alignment` | Queries match SCHEMA_CONCLUSION.md — names, soft delete, snapshots, tenancy |
| `/check-types` | No `any`, nullables handled, inputs typed |
| `/check-security` | Secrets, auth coverage, Razorpay webhook verification, server-side trust |
| `/check-ui-consistency` | Reuse of existing components/classes, loading/empty/error states, ₹ format |
| `/check-api-routes` | Status codes, one error format, input validation, no internal leaks |
| `/pre-commit-review` | Runs ALL checkers above → one combined report card |
| `/update-docs` | Finds doc sections made stale by the session's changes, proposes edits |

## Typical end-of-session flow

```
/pre-commit-review        ← one report card for everything
(fix what it flags, or say "fix the failures")
/update-docs              ← keep the rule-source docs truthful
```

Any checker can also be run alone mid-session (e.g. `/check-css-standards`
right after building a screen).

## Design principles (how these skills behave)

1. **Session-scoped.** Every checker reads `_shared/diff-scope.md` — it checks
   uncommitted work + branch commits vs master, nothing else. Pre-existing
   issues in untouched code never affect the verdict.
2. **Report only.** Checkers never modify files. You read the report and
   decide; saying "fix them" afterwards is always available.
3. **MUST vs SHOULD.** Every rule has a severity. MUST → ❌ fail,
   SHOULD → ⚠️ warn. Soften or harden a rule by changing that one word.
4. **Docs win.** If a skill rule ever contradicts PRD/STYLEGUIDE/SCHEMA docs,
   the doc is the source of truth — and the conflict itself gets flagged.

## How to refine (the whole point)

Everything is plain markdown — edit and the next run obeys:

- **Change a rule:** edit the sentence in that skill's `SKILL.md`.
- **Change severity:** move the rule between the MUST and SHOULD lists.
- **Add a rule:** add a numbered line under MUST or SHOULD.
- **Change scope for ALL skills:** edit `_shared/diff-scope.md`.
- **Change report style for ALL skills:** edit `_shared/report-format.md`.
- **Add a new checker:** copy any `check-*` folder, rewrite its rules, and
  add it to the list in `pre-commit-review/SKILL.md` (step 2).
- **Disable a checker:** remove it from pre-commit-review's list (kept
  individually runnable), or delete its folder entirely.

You can also just tell Claude in a session: "add a rule to check-css-standards
that ..." — editing these files IS the refinement workflow.
