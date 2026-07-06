---
name: check-ui-consistency
description: Verify this session's UI reuses existing components/classes and matches PRD UX rules — loading/empty/error states, feedback messages, ₹ formatting, freemium prompts. Use after building or editing any screen or component.
---

# Check UI Consistency

Checks that this session's UI looks and behaves like the rest of the app.
Rule sources: `STYLEGUIDE.md` (component classes) and `PRD.md` §7 UI/UX
principles. (CSS syntax rules live in /check-css-standards — this skill is
about reuse and UX behaviour.)

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect changed files.
This skill cares about: `*.tsx` and their paired `*.module.css`.

## Step 2 — Rules

### MUST rules — reuse

1. **Reuse before reinventing.** New UI must use the pre-built globals.css
   classes where one exists: `btn`, `badge`, `card`, `metric-card`,
   `form-*`, `input-prefix`, `alert`, `toast`, `data-table`, `pos-card`,
   `pay-pill`, `drawer`, `modal`, `empty-state`, `grid-*`, `page-header`.
   Writing a new button/badge/card variant in a module file when a global
   one fits is a failure.
2. **Reuse existing components** — check `components/` before creating a new
   one (e.g. `CustomSelect`, `Sidebar`, `TopBar`). Duplicating an existing
   component's job is a failure.
3. **Icons come from `lucide-react`** — no other icon library, no ad-hoc
   inline SVG icons when a lucide equivalent exists.

### MUST rules — UX states (PRD §7 "Clear feedback")

4. **Every async screen has a loading state** (skeleton or spinner — match
   existing pattern in the codebase).
5. **Every list/collection view has an empty state** (use `empty-state`
   class with a helpful prompt, per PRD's empty-dashboard flow).
6. **Every user action shows success/error feedback** (toast/alert) —
   silent failures or silent saves are failures.
7. **All money displayed uses ₹ Indian formatting** via the `formatINR`
   pattern (`en-IN`, e.g. ₹1,50,000) — no `$`, no plain `toFixed(2)`.

### SHOULD rules

8. Freemium behaviour matches PRD §9: limit modals at 50/30 items, Pro
   analytics shown blurred/locked (not hidden), upgrade prompts use
   `upgrade-banner` / `plan-bar` classes.
9. New screens SHOULD be mobile-responsive (PRD: POS especially must work on
   phone/tablet) — flag fixed pixel widths on content containers.
10. Typography follows the cheat sheet: page title in `page-header`, section
    headings h2/h3, muted text via `text-secondary`/`text-tertiary` — no
    one-off font sizing.
11. Wording SHOULD be simple, friendly, non-technical English (target user is
    a non-technical shop owner) — flag jargon like "entity", "payload",
    "transaction failed: 500".
12. Interactive elements SHOULD be accessible: buttons are `<button>`, inputs
    have labels, icon-only buttons have `aria-label`.

## Step 3 — Report

Read `.claude/skills/_shared/report-format.md` and produce the report.
Report only — do not fix.
