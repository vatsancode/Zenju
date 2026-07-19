# Frontend Audit — Baseline

> Reference point for `/frontend-audit` deltas. Raw metrics are recorded so a
> later run can diff the *numbers*, not just the scores.
> **Update only when the user asks**, normally after a refactor lands.

## Run: 2026-07-19 (first audit)

**Overall: 3.3 / 10 — Grade D+**
Scope: 42 tsx/ts files, 20 css files · 19,261 lines TS/TSX · 10,785 lines CSS

### Scorecard

| # | Area | Score | Key evidence |
|---|------|-------|--------------|
| 1 | Component Architecture | 3 | 3 primitives (`CustomSelect`, `SearchableSelect`, `Pagination`); 137 raw `.btn`; 65 raw `.form-input`; modal reimplemented 9× |
| 2 | Folder Organization | 6 | Convention documented & followed; 5 files >1,500 lines; dead `app/globals.css` stub |
| 3 | Code Consistency | 3 | `STATUS_LABELS`/`STATUS_BADGE` ×2, `PAYMENT_METHODS` ×2; 127 inline styles; 25 hex literals |
| 4 | State Management | 2 | 52/50/42/41 `useState` per component; global mock-array mutation; 14 files bypass `lib/services/` |
| 5 | Form Architecture | 2 | No form/validation library; ad-hoc `canSave` booleans per form |
| 6 | Styling System | 6 | Strong tokens + dark mode; zero enforcement; `.searchWrap` ×9 |
| 7 | Layout System | 3 | `.pageHead` ×3 + `.pageTitle`; no page shell; top bar driven by pathname regex |
| 8 | Reusable UI Patterns | 3 | `data-table` hand-rolled ×8; search ×9; only `Pagination` shared |
| 9 | UX Consistency | 3 | No `loading.tsx`/`error.tsx`/`not-found.tsx`; 0 skeletons; 6 loading-state names |
| 10 | Accessibility | 1 | **0** `role="dialog"` / `aria-modal` / focus traps across 9+ modals; Escape only on inputs; `role="switch"` missing `aria-checked` |
| 11 | Performance | 4 | **0** `next/dynamic`; memoization uneven (12 in one file, 0 in most) |
| 12 | Type Safety | 4 | `strict: true` ✅ but **57 `tsc` errors**; mock types vs DB types drifting |
| 13 | Error Handling | 1 | No error boundary anywhere |
| 14 | Responsiveness | 1 | **6 media queries in 10,785 CSS lines**; 17/20 modules have none |
| 15 | Animation & Motion | 5 | 8 consistent `@keyframes`; **0** `prefers-reduced-motion` |
| 16 | Reusability | 3 | Duplication is default, extraction the exception |
| 17 | Documentation | 6 | 3 solid docs; describe rules the code violates |
| 18 | Maintainability | 3 | `inventory/page.tsx` = 1,823 lines / 52 `useState` |
| 19 | Scalability | 3 | 14 files import `mock-data` directly → rewrite, not adapt, at API swap |
| 20 | Developer Experience | 3 | CI exists but **red on both jobs**; no Prettier/hooks/tests |

**Distribution:** 🔴 0–2: 5 · 🟠 3–4: 9 · 🟡 5–6: 4 · 🟢 7+: 0

### Raw metrics (diff these next run)

```
tsc errors ............................ 57   (all in app/dashboard/inventory/[id]/page.tsx)
eslint errors / warnings .............. 9 / 5
raw className="btn..." ................ 137
raw className="form-input..." ......... 65
inline style={{ }} .................... 127
hardcoded hex in *.module.css ......... 25
modal/overlay CSS classes ............. 9   (globals.css .modal-overlay unused)
role="dialog" | aria-modal ............ 0
focus traps ........................... 0
@media queries (all CSS) .............. 6
prefers-reduced-motion ................ 0
next/dynamic | React.lazy ............. 0
error.tsx | loading.tsx | not-found ... 0
skeleton components ................... 0
test files ............................ 0
files importing mock-data ............. 14
shared components in components/ui .... 3
files > 1500 lines .................... 5
largest file .......................... 1823 (app/dashboard/inventory/page.tsx)
max useState in one component ......... 52  (same file)
```

### Blockers at baseline

1. **`tsc` fails — 57 errors**, all in `app/dashboard/inventory/[id]/page.tsx`:
   typed as `InventoryItem` (`types/database.ts`) but used as `MockInventoryItem`
   — `.variants`, `.mrp`, `.attributes`, `.current_stock`, `.category`, `.unit`,
   `.availability_status` don't exist on the DB type; also imports a non-existent
   `StockUnit`.
2. **`npm run lint` fails — 9 errors:** 9× `react/no-unescaped-entities`
   (`dashboard/page.tsx`, `catalogue/page.tsx`, `ui/SearchableSelect.tsx`),
   plus a11y warnings for `role="switch"` without `aria-checked`.

Both are gated by `.github/workflows/ci.yml`, so **every PR is red**.

### Agreed sequencing

- **Phase 0** — fix 57 TS + 9 lint errors; add Prettier + lint-staged. → ~4.5
- **Phase 1** — primitives, starting with `<Modal>` (focus trap, Escape,
  `role="dialog"`): kills 9 duplicates *and* fixes the worst score. Then
  `Button`, `Input`, `PageHeader`, `DataTable`, `SearchInput`. → ~6.0
- **Phase 2** — shared `purchases/constants.ts`; mock access behind hooks;
  delete `app/globals.css`.
- **Phase 3** — decompose the 5 giant pages into feature folders.
- **Phase 4** — responsive pass, `prefers-reduced-motion`, error/loading
  boundaries, `next/dynamic` for modals, tests. → 7.5–8

### Note

The design tokens (`styles/globals.css`) and `docs/` are 7–8 quality work. This is
not an absent system — it's a good system nothing enforces. Most of Phase 1 is
*adopting what already exists* (e.g. the unused `.modal-overlay`), not inventing
new conventions.
