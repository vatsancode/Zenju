---
name: update-docs
description: Compare this session's changes against PRD.md, docs/css-styleguide.md, and docs/database-schema.md; flag stale/contradicted sections and propose exact doc edits. Use after any session that changed schema, features, or styling conventions.
---

# Update Docs

Keeps the three rule-source documents truthful. The checkers are only as good
as the docs they enforce — this skill finds where this session's changes made
a doc stale, and proposes the fix.

**This skill proposes doc edits — it never applies them without the user
saying yes.**

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect the session's changes.
All file types are relevant here.

## Step 2 — Compare changes against each doc

### vs docs/database-schema.md
- New/renamed tables, columns, constraints, indexes, views, or RPCs used in
  code but absent from the doc → propose the exact table-row addition.
- Enum-ish value sets that grew (new status, movement_type, etc.).
- Changed rules (soft delete, snapshots, derived stock) that code now
  contradicts — decide with the user: is the code wrong (checker territory)
  or is the doc outdated?

### vs PRD.md
- Features built beyond v1 scope, or v1-scope behaviour that shipped
  differently than specified (limits, flows, navigation items).
- Architecture drift — e.g. PRD says **Stripe** but the codebase uses
  **Razorpay**; PRD's table-count note vs the current
  docs/database-schema.md. Flag known drift once per report until fixed.
- New routes/pages not in the PRD navigation structure.

### vs docs/css-styleguide.md
- New shared classes added to globals.css that the styleguide doesn't list.
- New design tokens (CSS variables) not in the token reference.
- New reusable component patterns worth documenting (so future sessions
  reuse instead of reinvent).

### vs the skills themselves
- If this session introduced a new convention (a folder, a pattern, a rule),
  suggest which `.claude/skills/check-*/SKILL.md` should gain a rule for it.

## Step 3 — Report

```markdown
## Update Docs Report

**Verdict:** ✅ DOCS IN SYNC | 📝 <N> DOC UPDATES NEEDED

| # | Doc | Section | What's stale | Proposed edit (exact text) |
|---|-----|---------|--------------|----------------------------|
```

For each item give the exact replacement/added text so the user can approve
with a single "yes". After the report, ask which items to apply; apply only
the approved ones, then update each doc's "Last updated" footer line.
