---
name: find-promotable
description: Whole-codebase sweep for code that is defined locally but deserves to be shared — components, functions, constants, types and CSS blocks that are duplicated across files, or generic enough to belong in components/ui, lib/, types/ or globals.css. Names each candidate's destination. Standalone audit, not diff-scoped — NOT part of pre-commit-review.
---

# Find Promotable

Finds code that **already exists in more than one place**, or is generic enough
that the next feature will duplicate it, and names where it should live instead.

This is the retroactive counterpart to the `check-*` skills. Those are
*preventive* and diff-scoped — they stop this session from adding a tenth copy.
This one sweeps what previous sessions already left behind and produces a
promotion list.

## Why this is NOT session-scoped

Duplication is invisible in a diff: each copy was written in a different session,
and each looked reasonable at the time. Deliberately ignore
`_shared/diff-scope.md`. Scan `app/`, `components/`, `lib/`, `types/`, `styles/`
(skip `node_modules`, `.next`, `.claude/worktrees`).

Because a full sweep is slow, this is user-invoked. Do **not** add it to
`pre-commit-review` unless the user explicitly asks.

## Invocation

| Call | Runs |
|---|---|
| `/find-promotable` | All categories (A–E) |
| `/find-promotable components` | Category A only |
| `/find-promotable css` | Category D only |
| `/find-promotable app/dashboard/pos` | All categories, scoped to that folder |

## The destination map (where things go)

Mirrors `docs/architecture.md` — if this ever disagrees with that doc, **the doc
wins** and the conflict gets flagged.

| Kind of code | Belongs in |
|---|---|
| Generic, feature-agnostic UI building block | `components/ui/` |
| Reusable UI tied to one feature | `components/<feature>/` |
| Page shell / chrome | `components/layout/` |
| Pure helper (formatting, parsing, math) | `lib/` |
| Business logic / data access | `lib/services/` |
| Type used by 2+ files | `types/` |
| Constant map used by 2+ files | `<domain>/constants.ts`, or `lib/` if cross-domain |
| Style used by 2+ components | `styles/globals.css` |
| Style used by exactly 1 component | that component's `.module.css` |

## Step 1 — Check what's already shared

**Do this first.** The worst finding is a shared version that already exists and
nobody adopted — that's a zero-effort fix, so it must lead the report.

```bash
ls components/ui/ components/layout/
ls lib/*.ts lib/services/
grep -n "^\.[a-z-]*\s*{" styles/globals.css | head -60      # existing global classes
grep -n "^export" types/database.ts | head -40
```

Hold this inventory. Every candidate below must be checked against it before
being reported as "needs creating" — it may only need *importing*.

> Real example: `styles/globals.css` defines `.modal-overlay` and `.modal`, while
> **9** module files hand-rolled their own overlay. The fix there is adoption,
> not authorship — say so.

## Step 2 — Find candidates

### A. Duplicated components / JSX blocks

```bash
# repeated structural class names across modules
grep -rn "Overlay\s*{\|Modal\s*{\|Popup\s*{\|Drawer\s*{" --include="*.css" app components styles
grep -rn "\.searchWrap\|\.searchInput\|\.pageHead\|\.toolbar\|\.filterRow" --include="*.module.css" app components | grep "{"
# repeated JSX shells
grep -rn "role=\"dialog\"\|className={styles.overlay}\|Overlay}" --include="*.tsx" app components
grep -rl "data-table" --include="*.tsx" app components
```

For each pattern found in **2+ files**: read two of them and confirm they're the
same *job*, not just a similar name. Report the site count and the destination.

**Sub-components living inside pages count too** — a `function XPopup()` defined
at the bottom of a `page.tsx` and a near-identical one in another page is a
promotion candidate even though neither is in `components/`.

```bash
grep -rn "^function [A-Z]" --include="*.tsx" app        # components defined inside route files
```

### B. Duplicated functions

```bash
# same function name defined in 2+ files
grep -rhn "^\s*\(export \)\?\(async \)\?function [a-z][A-Za-z0-9_]*" --include="*.tsx" --include="*.ts" app components \
  | sed 's/.*function \([A-Za-z0-9_]*\).*/\1/' | sort | uniq -d
```

Then for each duplicate name, locate the definitions and compare bodies:

```bash
grep -rn "function <name>" --include="*.tsx" --include="*.ts" app components
```

Also flag **single-site but obviously generic** helpers — formatters, parsers,
ID/number generators, byte/date math. Test: *would a second feature want this
unchanged?* If yes it belongs in `lib/`, even at one call site.
(e.g. `formatFileSize` is generic → `lib/`; `genPoNumber` is domain logic →
`lib/services/purchases.ts`.)

### C. Duplicated constants & types

```bash
# constant maps / option arrays defined in more than one file
grep -rn "_LABELS\s*[:=]\|_BADGE\s*[:=]\|_OPTIONS\s*[:=]\|_METHODS\s*[:=]\|_STATUS\s*[:=]" \
  --include="*.tsx" --include="*.ts" app components | grep -i "const"
# local types that mirror shared ones
grep -rn "^\s*\(export \)\?\(type\|interface\) " --include="*.tsx" app | head -30
```

A `Record<Status, string>` map defined identically in two files is a **MUST**
finding, not a nice-to-have: it will eventually be updated in one place only.
(This exact bug bit `STATUS_BADGE` in `purchases/page.tsx` and
`purchases/[id]/page.tsx`.)

For types, cross-check against `types/database.ts` — a locally-declared type that
duplicates or partially mirrors a shared one is drift, and drift causes
type errors later.

### D. Duplicated CSS blocks

```bash
# near-identical rule bodies across modules
grep -rn "position: fixed" --include="*.module.css" app components
grep -rn "display: flex;" --include="*.module.css" app components | wc -l
# module files redefining a globals.css class
grep -rn "\.btn\b\|\.card\b\|\.badge\b\|\.modal\b\|\.drawer\b\|\.empty-state\b" --include="*.module.css" app components
```

Same/near-identical rule block in 2+ modules → promote to `globals.css`
(`check-css-standards` rule 6, applied to the whole tree instead of the diff).
A module redefining an existing global class is a **MUST** finding.

### E. Repeated inline patterns

```bash
grep -rn 'style={{' --include="*.tsx" app components | sed 's/.*style={{//' | sort | uniq -c | sort -rn | head -15
```

The same inline style object repeated across files should become a utility class
or a component prop.

## Step 3 — Rank

Not every duplicate is worth promoting. Rank by **(sites × churn) ÷ effort**:

- **Promote now** — 3+ sites, or 2 sites where the copies have *already diverged*
  (divergence proves the update-one-place bug is live), or a shared version
  already exists unused.
- **Promote when next touched** — 2 identical sites, low churn.
- **Leave** — superficial similarity, different jobs, or abstracting would
  couple genuinely unrelated features. **Say so explicitly**; a report that
  flags everything gets ignored. Premature abstraction is a real cost.

## Step 4 — Report

```markdown
## Find Promotable Report

**Scope:** <N> files scanned under <folders>
**Candidates:** <X> promote now · <Y> later · <Z> reviewed and left alone

### ⚡ Already shared but not adopted
<Zero-effort wins: a global class or lib helper exists and nobody imports it.
 Lead with these. "none" if none.>

| Existing shared thing | Sites reinventing it | Fix |
|---|---|---|
| `globals.css .modal-overlay` | 9 modules | import instead of redefining |

### Promote now
| # | What | Kind | Sites | Diverged? | Destination |
|---|------|------|-------|-----------|-------------|
| 1 | Modal/overlay shell | A | 9 | yes | `components/ui/Modal.tsx` |
| 2 | `STATUS_LABELS` + `STATUS_BADGE` | C | 2 | no | `app/dashboard/purchases/constants.ts` |

### Promote when next touched
| # | What | Kind | Sites | Destination |
|---|------|------|-------|-------------|

### Reviewed, leaving alone
| What | Why not |
|------|---------|
| `.searchWrap` in POS vs inventory | different layout constraints, not the same component |

### Suggested order
<Sequence the "promote now" list so shared dependencies land first —
 e.g. Modal before the popups that will consume it. Note where one
 promotion unblocks several others.>
```

### Behaviour rules

1. **Report only.** Never create or move files during a sweep. "Do #1 and #2"
   afterwards is a separate action.
2. **Every candidate needs 2+ real sites, or an explicit generic-helper
   justification.** No promoting on a hunch — cite the files.
3. **Check `components/ui/`, `lib/` and `globals.css` before proposing anything
   new.** Proposing a component that already exists is the one failure mode that
   makes this skill actively harmful.
4. **Name the destination, not just the problem.** "Duplicated" is not
   actionable; "→ `components/ui/DataTable.tsx`" is.
5. **`docs/architecture.md` wins** on placement. If a finding contradicts it,
   flag the contradiction rather than silently overriding it.
6. **Respect ambiguity.** Where reuse-vs-extend-vs-keep-separate is a genuine
   judgement call (same rule as `check-folder-structure` #5), present the options
   and let the user pick — don't resolve it in the report.
