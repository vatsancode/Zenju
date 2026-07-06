---
name: check-css-standards
description: Verify this session's UI code follows STYLEGUIDE.md — no Tailwind, design tokens only, globals.css vs module.css split, BEM naming. Use after writing or editing any .tsx or .css file.
---

# Check CSS Standards

Enforces `STYLEGUIDE.md` on this session's changes. If a rule here ever
conflicts with STYLEGUIDE.md, **STYLEGUIDE.md wins** — flag the conflict too.

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect changed files.
This skill cares about: `*.tsx`, `*.css`, and any config files
(`tailwind.config.*`, `package.json` for style-related deps).

## Step 2 — Rules

### MUST rules (from STYLEGUIDE.md — the Golden Rule)

1. **No Tailwind, ever.** No utility-string classNames
   (`className="flex items-center gap-4 text-sm"`), no `tw-` prefixes,
   no `tailwind.config.js`, no Tailwind packages in package.json.
2. **No hardcoded hex/rgb colors** in `.tsx` inline styles or in `.module.css`
   — always CSS variables (`var(--color-...)`). Applies to text, backgrounds,
   borders.
3. **No magic numbers for spacing/radius/font-size in module files** — use
   `var(--space-*)`, `var(--radius-*)`, `var(--text-*)`.
4. **Inline `style={{}}` only for runtime-dynamic values** (e.g.
   `style={{width: `${pct}%`}}`). Static inline styles are a violation.
5. **Never re-define a globals.css class in a module file** (`.btn`, `.card`,
   `.badge`, `.form-input`, `.metric-card`, `.data-table`, `.alert`, `.toast`,
   `.pos-card`, `.nav-item`, `.drawer`, `.modal`, `.grid-*`, etc.).
6. **Placement rule:** style used by 2+ components → `globals.css`;
   style used by exactly 1 component → that component's `.module.css`.
   If this session added the same/near-identical rule block to two module
   files, flag it for promotion to globals.css.

### SHOULD rules

7. Global classes follow the existing **BEM-ish naming**
   (`block__element`, `block--modifier`); module classes are **camelCase and
   descriptive** (`.formPanel`, `.recipeRow` — not `.panel`, `.row`).
8. Reuse the pre-built globals.css component classes (buttons, badges, cards,
   forms, alerts, tables) instead of writing new equivalents.
9. Transitions use `var(--transition-*)`; layout constants use
   `var(--sidebar-width)` / `var(--topbar-height)`.
10. Dark mode: no color logic in JS/JSX beyond the documented
    `data-theme="dark"` toggle — colors flip via CSS variables only.
11. Currency displayed to users SHOULD go through the `formatINR` pattern
    (`Intl.NumberFormat('en-IN')`), not manual string building.

## Step 3 — Report

Read `.claude/skills/_shared/report-format.md` and produce the report.
Report only — do not fix.
