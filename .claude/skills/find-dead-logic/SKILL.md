---
name: find-dead-logic
description: Sweep the whole codebase (not just this session's diff) for logic, state, and code that is defined but never actually reachable from the UI or from any caller — the "wired to nothing" bug class. Use on demand, as its own call — NOT part of pre-commit-review, because it scans the whole project and is too slow/noisy to run on every commit.
---

# Find Dead Logic

Finds code that *looks* functional — it type-checks, it has a plausible name,
it even gets referenced by other dead code around it — but has no live path
from a real user action or a real caller to it. This is different from
"unused variable" lint warnings: the target here is small pockets of a
component (a `useState`, a handler, a few type fields) that were once wired
to a UI control which was later removed or never finished, leaving the state
permanently stuck at its default and every branch that reads it permanently
unreachable.

Concrete example that motivated this skill: `app/dashboard/inventory/page.tsx`
had `has_variation`, `quantity`, and a `variants` array in its form state,
plus `handleAddVariantRow` / `updateVariantAttr` / `updateVariantField`
functions and matching state in the edit drawer (`editHasVariation`,
`editVariants`). None of it had a rendered toggle, input, or button —
`has_variation` could never become `true`, so the "has variants" branch in
the submit handler was dead on arrival. The tell was that the form's own
numbered section comments (`── 3. Unit ──`, `── 6. Image ──`) skipped
numbers 4 and 5 — a section had been deleted from the JSX but its state and
handlers were left behind.

## Why this is NOT session-scoped (unlike the other check-* skills)

This bug class is invisible in a diff — the dead code was usually written in
a *previous* session, and this session's diff only touches nearby lines.
Deliberately ignore `_shared/diff-scope.md` here. Scan the real source tree:
`app/`, `components/`, `lib/`, `types/` (skip `node_modules`, `.next`,
`.claude/worktrees`, generated files).

Because a full sweep is slower and noisier than a diff check, this is a
standalone, user-invoked audit — do not add it to `pre-commit-review`'s
checker list even if asked casually; only wire it in if the user explicitly
says so after seeing what it reports.

## Step 1 — Inventory candidate files

List `.tsx`/`.ts` files under `app/`, `components/`, `lib/` (excluding
`*.d.ts`, `*.test.ts*`, config files). For very large codebases, the user may
scope this to a folder (e.g. "just check app/dashboard/inventory") — honor
that if given, otherwise cover everything.

## Step 2 — Rules

For each rule, a finding needs a concrete grep/read to back it — don't guess
from naming alone.

### A. Unwired state (highest-value check)
For every `useState` (or reducer/context field) in a client component, find
every place its setter is called. If every call site is inside a function
that is *itself* never referenced from JSX (see rule B) — or there are zero
call sites outside the initializer — the state can never leave its default.
Trace forward: any `if`/ternary/conditional render or payload field keyed off
that state is dead code too, and worth naming explicitly ("this branch never
runs because X can never become true").

### B. Orphaned handlers
A function defined in a component/module that is not:
- referenced in any JSX prop (`onClick`, `onChange`, `onSubmit`, `ref`, etc.), AND
- called by any other function that itself passes rule B or is exported/used elsewhere

...is dead. Grep for the function name across the file (and the codebase, for
exported helpers) — if the only match is the definition itself, it's dead.

### C. Form fields with no matching control
For a form's local `type` (e.g. `NewItemForm`), check every field has at
least one JSX element that both reads (`value={form.x}`) and writes
(`onChange`/`onClick` calling `setForm` with key `x`) it. A field that's read
in the submit payload but never set by any control means the field always
submits its default value — flag it as silently-wrong, not just unused.

### D. Skipped or orphaned numbered section markers
If a file uses numbered inline section comments (e.g. `── 4. Quantity ──`),
list all the numbers found in file order. Any gap in the sequence is a strong
signal a section's JSX was deleted while its supporting state/handlers/type
fields survived — go find what state that missing section would have
controlled (rules A/B/C above) and report it together.

### E. Dead exports
For an exported function/component/type/const, grep the whole repo for its
name outside its own file. Zero matches → dead export. Be careful with:
Next.js special exports (`page.tsx` default export, `generateMetadata`,
route handlers `GET`/`POST`/etc.) which are framework-invoked, not
import-invoked — never flag these.

### F. UI with no backing API, or API with no caller
- A client component that builds a payload and calls `fetch('/api/...')` —
  confirm the route file exists and its handler is not a stub (`Not
  implemented`, hardcoded empty response, `TODO`).
- An API route / service function that exists and is fully implemented but
  has zero `fetch`/client callers anywhere in `app/` or `components/` —
  flag as backend built ahead of any UI that uses it (not necessarily wrong,
  but worth confirming it's intentional in-progress work).

### G. Payload fields the backend silently drops
Compare a form's submit payload keys against what the receiving API route /
service function actually reads and persists. A key sent by the client but
never read server-side means user input is silently discarded — flag with
both sides shown.

## Step 3 — Report

```markdown
## Find Dead Logic Report

**Scope:** <N> files scanned under <folders>
**Findings:** <X> dead-code pockets found

### Findings
| # | File:Line | Kind (A–G) | What's dead | Why it can never run | Suggested action |
|---|-----------|------------|-------------|----------------------|-------------------|
| 1 | app/dashboard/inventory/page.tsx:39 | A | `has_variation` state | no toggle/control anywhere sets it to true | remove state + all branches reading it, or build the missing control |

### Notes
- Group findings that share a root cause (e.g. one deleted section that
  orphaned five identifiers) into one row with a combined line range, rather
  than five separate rows — that's usually more useful for deciding what to
  do next.
```

Report only — do not delete or edit anything unless the user says "remove
these" or "fix them" after reading the report.
