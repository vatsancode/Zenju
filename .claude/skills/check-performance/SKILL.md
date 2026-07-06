---
name: check-performance
description: Check this session's code for algorithmic and query inefficiencies — O(n²) loops, N+1 Supabase queries, over-fetching, wasteful re-renders. Use after writing data handling, list rendering, or query code.
---

# Check Performance

Judges this session's changes for efficiency: data-structure choices,
Supabase query patterns, and React render behaviour. For a POS/inventory app,
query shape matters more than raw algorithm speed — a laggy POS loses sales.

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect changed files.
This skill cares about: `*.ts`, `*.tsx`.

## Step 2 — Rules

### MUST rules — algorithms & data structures

1. **No nested linear scans over the same data.** `.find()` / `.filter()` /
   `.includes()` inside a `.map()` / loop over a related list is O(n²) —
   build a `Map` / `Set` lookup first (O(n)).
2. **No queries inside loops (N+1).** A Supabase call per item in a loop must
   become one query with `.in('id', ids)` or a join/select with relations.
3. **No fetching entire tables to compute one number.** Counts use
   `{ count: 'exact', head: true }`; sums/aggregates fetch only needed columns
   or use a view/RPC — never pull all rows to reduce client-side.
4. **Lists that grow with business data must be paginated or limited**
   (`.range()` / `.limit()`), especially `sales`, `sale_items`,
   `stock_movements`, `event_log` — the schema says these grow forever, and
   queries on them must be date-range filtered.

### MUST rules — queries

5. **Select only the columns used** — no bare `select('*')` on wide/hot tables
   when just a few fields are consumed.
6. **Independent async calls run in parallel** (`Promise.all`), not awaited
   one-by-one in sequence.

### SHOULD rules — React

7. Derived data computed from large lists inside a component body SHOULD be
   memoized (`useMemo`); handlers passed to long lists SHOULD use `useCallback`.
8. List rendering uses **stable keys** (ids), never array index for mutable
   lists.
9. No state updates inside loops causing render storms — batch into one update.
10. Client components SHOULD not import heavy dependencies they barely use;
    consider dynamic import for rarely-shown heavy UI (charts, QR).

### SHOULD rules — misc

11. Repeated `.filter()` passes over the same array to derive multiple groups
    SHOULD be one loop / reduce.
12. Expensive work (formatting, sorting) SHOULD happen once outside JSX, not
    per-render inside the map body.

## Step 3 — Report

Read `.claude/skills/_shared/report-format.md` and produce the report.
For each finding, state the complexity/cost in plain words
(e.g. "50 items × 50 lookups = 2,500 scans per render").
Report only — do not fix.
