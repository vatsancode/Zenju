---
name: frontend-audit
description: Score the whole frontend against the 20-point engineering checklist — component architecture, state, forms, styling, layout, a11y, performance, types, responsiveness, DX. Produces a scorecard (0–10 per section) with evidence. Run whole (`/frontend-audit`) or one section at a time (`/frontend-audit 10`, `/frontend-audit accessibility`). Standalone audit — NOT part of pre-commit-review.
---

# Frontend Audit

Scores the frontend against a 20-point professional engineering checklist and
produces a **scorecard with evidence** — every score must be backed by a real
command output, never a vibe.

This is a *health check on the whole codebase*, unlike the `check-*` skills which
judge one session's diff. Use it to decide what to refactor next, and to prove
the refactor worked (scores should move between runs).

## Why this is NOT session-scoped

The problems it looks for are **accumulated**, not introduced: a modal reimplemented
for the ninth time, a page that grew to 1,800 lines, a design token system nothing
enforces. None of that shows up in a diff. Deliberately ignore
`_shared/diff-scope.md`. Scan the real source tree: `app/`, `components/`, `lib/`,
`types/`, `styles/` (skip `node_modules`, `.next`, `.claude/worktrees`).

Because a full sweep is slow, this is a standalone, user-invoked audit — do **not**
add it to `pre-commit-review`'s checker list unless the user explicitly asks.

## Invocation — running the whole thing or one section

| Call | Runs |
|---|---|
| `/frontend-audit` | All 20 sections + overall score |
| `/frontend-audit 10` | Section 10 only (Accessibility) |
| `/frontend-audit accessibility` | Same — name matching is case-insensitive, partial OK |
| `/frontend-audit 1,3,16` | Sections 1, 3 and 16 |
| `/frontend-audit critical` | The 5 lowest-scoring areas from `baseline.md` |
| `/frontend-audit app/dashboard/pos` | All sections, scoped to that folder |

When only some sections run, report **only those** and skip the overall score —
say "partial audit, N of 20 sections" instead of inventing a total.

## Step 0 — Establish scope

```bash
# Source tree size (denominator for most ratios)
find app components lib types -name "*.tsx" -o -name "*.ts" | wc -l
find app components styles -name "*.css" | wc -l
```

If the user scoped to a folder, pass that path to every command below instead of
`app components`.

## Step 1 — Run the section checks

Each section states **what to measure**, **the command**, and **how to score**.
Run the command; do not estimate. If a command returns nothing, that's a real
result (often a 0 or a 10), not a reason to skip.

Scoring is 0–10, calibrated as: **0–2** critical/absent · **3–4** weak ·
**5–6** adequate · **7–8** good · **9–10** exemplary.

---

### 1. Component Architecture
Reusable library, composition over duplication, small focused components.

```bash
ls components/ui/*.tsx 2>/dev/null | wc -l              # shared primitives
grep -ro 'className="btn[^"]*"' --include="*.tsx" app components | wc -l
grep -ro 'className="form-input[^"]*"' --include="*.tsx" app components | wc -l
grep -rn "Overlay\s*{\|overlay\s*{" --include="*.css" app components styles   # modal reimplementations
```

**Score:** 8+ if primitives exist and raw class usage is rare. Subtract heavily for
each UI pattern implemented more than twice. **Check whether `globals.css` already
defines a shared version that nobody imports** — an unused `.modal-overlay`
alongside 9 hand-rolled ones is worse than having neither.

### 2. Project & Folder Organization
Feature-grouped, colocated, shallow, consistently named.

```bash
find app components lib types -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -12
find . -path ./node_modules -prune -o -name "*.css" -size -500c -print   # stub/dead files
# note: use -500c (bytes) not -1k — find's -1k rounds up and matches nothing
```

**Score:** deduct for every file over 800 lines (a component that large is not
"organized" regardless of its folder). Cross-check against `docs/architecture.md` —
the convention existing but being ignored scores worse than no convention.

### 3. Code Consistency
One way to solve each problem; no duplicated constants or logic.

```bash
grep -rn "_LABELS:\s*Record\|_BADGE:\s*Record\|_OPTIONS\s*[:=]" --include="*.tsx" app components | grep const
grep -rn 'style={{' --include="*.tsx" app components | wc -l
grep -rn "#[0-9a-fA-F]\{3,6\}\b" --include="*.module.css" app components | grep -v "var(--" | wc -l
```

**Score:** any constant map defined identically in 2+ files is an automatic ceiling
of 5 — it means a change needs to be made twice and *will* eventually be made once
(this exact bug happened with `STATUS_BADGE`). Inline styles and hex literals
violate `docs/css-styleguide.md`; count them.

### 4. State Management
State near usage, UI vs app state separated, no prop drilling.

```bash
for f in $(find app components -name "*.tsx"); do c=$(grep -c "useState" "$f"); [ "$c" -gt 10 ] && echo "$c $f"; done | sort -rn
grep -rn "\.unshift(\|\.push(" --include="*.tsx" app components | grep -i mock    # global mutation
grep -rl "mock-data" --include="*.tsx" app components | wc -l                      # bypassing services
ls lib/hooks/ 2>/dev/null || echo "NO HOOKS DIR"
```

**Score:** 20+ `useState` in one component caps at 3. Components mutating shared
module-level arrays directly caps at 3 — that is not state management, and it makes
the eventual API swap expensive. Extracted hooks raise the score.

### 5. Form Architecture
Standardized handling, reused validation, scalable.

```bash
grep -n "react-hook-form\|formik\|zod\|yup" package.json || echo "NO FORM/VALIDATION LIB"
grep -rn "const can\(Save\|Create\|Confirm\|Submit\)" --include="*.tsx" app components   # ad-hoc validation
```

**Score:** no form library + per-form hand-rolled boolean validation caps at 3.
Look for the *same* validation rule written differently in two places.

### 6. Styling System
Centralized tokens, reusable utilities, minimal duplication.

```bash
grep -c "^\s*--color-\|^\s*--space-\|^\s*--radius-\|^\s*--text-" styles/globals.css
grep -rn "#[0-9a-fA-F]\{3,6\}\b" --include="*.module.css" app components | grep -v "var(--" | wc -l
find app components styles -name "*.css" | xargs wc -l | tail -1
grep -rn "\.searchWrap\|\.searchInput\|\.pageHead" --include="*.module.css" app components | grep "{"
```

**Score this in two halves and say both:** token *design* and token *enforcement*.
A strong system nobody follows is roughly a 6, not a 9 — note the gap explicitly so
it's clear the fix is adoption, not authorship.

### 7. Layout System
Reusable page shells, standardized headers/toolbars.

```bash
grep -rn "\.pageHead\|\.pageHeader\|\.pageTitle" --include="*.module.css" app components | grep "{"
ls components/layout/
grep -rn "pathname\|usePathname" --include="*.tsx" components/layout   # brittle route logic
```

**Score:** each independently-defined page header costs a point. Flag layout
decisions driven by **pathname regex** — they break silently when routes are added
(this is how the top bar leaked onto `/purchases/[id]/edit`).

### 8. Reusable UI Patterns
Tables, cards, lists, filters, search, pagination, nav.

```bash
grep -rl "data-table" --include="*.tsx" app components | wc -l
grep -rn "\.searchWrap\|\.searchInput" --include="*.module.css" app components | grep "{" | wc -l
ls components/ui/
```

**Score:** for each of the 7 patterns, is there **one** implementation? Score ≈
`(patterns shared / 7) * 10`.

### 9. UX Consistency
Predictable interactions; standardized loading/empty/error.

```bash
find app -name "loading.tsx" -o -name "error.tsx" -o -name "not-found.tsx" | sort
grep -rn "skeleton" --include="*.tsx" --include="*.css" app components styles | wc -l
grep -rn "useState" --include="*.tsx" app components | grep -i "loading" | sed 's/.*const \[//;s/,.*//' | sort -u
```

**Score:** zero `loading.tsx`/`error.tsx` caps at 3. Six different names for the
same loading concept (`isLoading`, `itemsLoading`, `unitsLoading`…) is the tell for
"no standard".

### 10. Accessibility ⚠️ *most commonly the lowest score — check first*
Keyboard nav, semantic HTML, screen readers, contrast, focus.

```bash
grep -rn 'role="dialog"\|aria-modal\|aria-labelledby' --include="*.tsx" app components | wc -l
grep -rc "Overlay\|modal-overlay" --include="*.tsx" app components | grep -v ":0"   # modals needing the above
grep -rn "Escape" --include="*.tsx" app components | wc -l
grep -rn "focus-trap\|useFocusTrap\|inert" --include="*.tsx" app components | wc -l
npm run lint 2>&1 | grep -i "aria\|a11y\|role"
```

**Score:** modals without `role="dialog"` + `aria-modal` + focus trap is an
automatic **1–2**, regardless of everything else — it makes the app unusable with a
screen reader. `Escape` handlers on *individual inputs* rather than the modal do not
count: check *where* the handler is attached, not that the string appears.
Also verify `role="radiogroup"`/`role="tablist"` elements implement arrow-key
navigation, not just the role attribute.

### 11. Performance
Re-renders, splitting, lazy loading, list rendering, bundle.

```bash
grep -rn "next/dynamic\|React.lazy" --include="*.tsx" app components | wc -l
grep -rc "useMemo\|useCallback\|React.memo" --include="*.tsx" app components | grep -v ":0"
find app components -name "*.tsx" | xargs wc -l | sort -rn | head -5
```

**Score:** zero dynamic imports with heavy modals in the tree caps at 5. Uneven
memoization (12 in one file, 0 in most) signals reactive rather than systematic
optimization — mention that pattern rather than just the count.

### 12. Type Safety
Strong interfaces, shared types, no duplicate definitions.

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep "error TS" | sed 's/(.*//' | sort | uniq -c | sort -rn
grep -n "strict\|noUncheckedIndexedAccess\|exactOptionalPropertyTypes" tsconfig.json
grep -n "^export interface\|^export type" lib/mock-data.ts types/database.ts | wc -l
```

**Score:** **any** `tsc` error caps this at 4 and must be the report's headline —
a red typecheck means the safety net is off for the whole codebase. Also flag
parallel type systems (mock types vs DB types) as active drift; that drift is
usually the *cause* of the errors.

### 13. Error Handling
Consistent error UI, graceful failure, contained blast radius.

```bash
find app -name "error.tsx" -o -name "global-error.tsx" | sort
grep -rn "ErrorBoundary\|componentDidCatch" --include="*.tsx" app components | wc -l
grep -rn "catch\s*(" --include="*.tsx" app components | wc -l
```

**Score:** no error boundary anywhere → **1**. One thrown error blanks the app.

### 14. Responsiveness
Multiple screen sizes, smooth adaptation.

```bash
grep -rc "@media" --include="*.css" app components styles | sort -t: -k2 -rn
grep -rn "@media" --include="*.css" app components styles | wc -l
grep -rn "width:\s*[0-9]\{3,\}px" --include="*.css" app components | wc -l   # fixed widths
```

**Score:** compute *modules with zero media queries / total modules*. Above ~70%
with none → **1–2**. Fixed pixel widths on containers compound it.

### 15. Animation & Motion
Consistent, purposeful, reduced-motion aware.

```bash
grep -rn "@keyframes" --include="*.css" app components styles | wc -l
grep -rn "prefers-reduced-motion" --include="*.css" app components styles | wc -l
```

**Score:** animations present with **zero** `prefers-reduced-motion` caps at 5 —
it's an accessibility failure, not a polish item.

### 16. Reusability
Reusable over one-off; early extraction.

Synthesize from §1, §3, §7, §8 rather than new commands — reusability is the
through-line. Ask: *when this codebase needed a thing twice, did it extract or
copy?* Score the answer.

### 17. Documentation
Documented components, current examples, clear guidelines.

```bash
ls docs/
ls .storybook 2>/dev/null || echo "NO STORYBOOK"
find components -name "README.md" -o -name "*.stories.*" | wc -l
```

**Score:** credit good docs — but if the docs describe rules the code violates
(hex literals, inline styles, services bypassed), cap at 6 and say docs are
*aspirational*. Accurate-but-thin beats thorough-but-false.

### 18. Maintainability
Readable files, separated concerns, refactored duplication.

```bash
find app components -name "*.tsx" | xargs wc -l | sort -rn | head -10
for f in $(find app components -name "*.tsx"); do c=$(grep -c "useState" "$f"); [ "$c" -gt 20 ] && echo "$c $f"; done | sort -rn
```

**Score:** frame it as onboarding cost — "changing one table means reading N lines"
is more actionable than a raw line count.

### 19. Scalability
Evolves without rewrites; loosely coupled.

Synthesize from §4 (data layer), §12 (types), §1 (components). The question:
**what breaks when the mock layer is replaced with real Supabase calls?** Every
component importing `mock-data` directly and mutating module arrays is a file that
must be rewritten, not adapted. Count those files — that number *is* the score
basis.

### 20. Developer Experience
Less repetition, easy onboarding, easy debugging.

```bash
cat .github/workflows/*.yml 2>/dev/null | grep -A2 "run:" || echo "NO CI"
npm run lint 2>&1 | tail -20
npx tsc --noEmit 2>&1 | grep -c "error TS"
ls .prettierrc* .husky 2>/dev/null || echo "NO PRETTIER/HOOKS"
find . -path ./node_modules -prune -o \( -name "*.test.*" -o -name "*.spec.*" \) -print | wc -l
```

**Score:** **CI that exists but fails is worse than no CI** — it trains the team to
ignore red. If `npm run lint` or `tsc` fails, cap at 3 and lead the report with it.

---

## Step 2 — Score and report

Simple average of the sections run (no weighting), to one decimal.
Grade: **9+** A · **8** B · **7** C · **5–6** D · **<5** F.

```markdown
## Frontend Audit Report

**Scope:** <N> tsx/ts + <M> css files under <folders>
**Sections:** all 20 | partial (<list>)
**Overall:** <X.X> / 10 — Grade <G>   ← omit for partial runs
**vs baseline:** <+/-X.X> since <date>   ← if baseline.md exists

### 🔴 Blockers
<Anything that makes CI red or the app unusable for a class of user.
 Empty section = say "none".>

### Scorecard
| # | Area | Score | Δ | Evidence |
|---|------|-------|---|----------|
| 1 | Component Architecture | 3 | — | 3 primitives; 137 raw `.btn`; modal built 9× |
...

### Distribution
🔴 0–2: <n>  ·  🟠 3–4: <n>  ·  🟡 5–6: <n>  ·  🟢 7+: <n>

### Highest-leverage fixes
<3–5 items, ordered by (sections improved × risk reduced) ÷ effort.
 Prefer fixes that move several scores at once — e.g. one accessible
 `<Modal>` raises §1, §3, §10, §13 and §16 simultaneously.>

### Projected
"<fix> → §<n> <a>→<b>, overall <x.x>→<y.y>"
```

### Behaviour rules

1. **Report only.** Never fix during an audit — the score is the deliverable.
   "Fix the blockers" afterwards is always available and is a separate action.
2. **Every score needs a number from a command.** No score may rest on reading
   code and forming an impression. If a check couldn't run, say so and mark the
   section `n/a` rather than guessing.
3. **Score the codebase, not the author.** "Modal implemented 9× because no
   shared one was adopted" — not "sloppy duplication". Findings should read as
   solvable, because they are.
4. **Credit what's good, specifically.** A strong token system or accurate docs
   should be named and scored well; a report that's uniformly negative gets
   dismissed and stops being useful.
5. **Update `baseline.md` only when the user asks** — usually after a refactor
   lands, so the delta stays meaningful.
