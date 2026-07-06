---
name: check-types
description: Verify this session's TypeScript is strict and safe — no any, no ts-ignore, nullable Supabase results handled, inputs validated. Use after writing any .ts or .tsx code.
---

# Check Types

Checks type discipline in this session's changes. The goal: bugs caught at
compile time, not at the POS counter.

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect changed files.
This skill cares about: `*.ts`, `*.tsx`, `tsconfig.json`.

Also run `npx tsc --noEmit` if the project compiles quickly; include any
errors that trace to changed files as findings.

## Step 2 — Rules

### MUST rules

1. **No `any`** — explicit or via `as any`. Use a proper type, a generic,
   or `unknown` + narrowing.
2. **No `@ts-ignore` / `@ts-expect-error`** without a one-line justification
   comment; bare suppressions are failures.
3. **Nullable Supabase results are handled.** Every `const { data, error }`
   must check `error` and handle `data === null` before use. No `data!`.
4. **No non-null assertions (`!`)** on values that can genuinely be
   null/undefined at runtime (env vars, query results, `find()` results).
5. **API route inputs are typed and validated** before use — `await
   req.json()` results must not be spread straight into a DB call untyped.
6. **Shared shapes come from `types/`** — do not re-declare a row/entity
   interface locally when it exists (or belongs) in `types/database.ts`.

### SHOULD rules

7. Function parameters and return types on exported functions SHOULD be
   explicit — no leaning on inference across module boundaries.
8. Prefer union literal types for enum-ish values
   (`'cash' | 'upi' | 'card'`) over `string`.
9. Avoid type assertions (`as X`) where a type guard or schema check would
   prove the shape instead.
10. Numeric money values SHOULD be typed and named clearly (paise vs rupees)
    — flag mixed/unclear currency-unit arithmetic.

## Step 3 — Report

Read `.claude/skills/_shared/report-format.md` and produce the report.
Report only — do not fix.
