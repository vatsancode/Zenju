---
name: check-folder-structure
description: Verify that files added or moved in this session follow the project folder structure (app/, components/, lib/, styles/, types/). Use after writing code to confirm every new file lives where the architecture says it should.
---

# Check Folder Structure

Checks that this session's new/moved files are in the right place and that code
is at the right layer (UI vs service vs route).

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect the session's changed
files. This skill cares about ALL added/renamed files, plus modified `.tsx`/`.ts`
files (to catch logic written at the wrong layer).

## Step 2 — Rules

### The folder map (source of truth)

```
app/                      → routes ONLY: page.tsx, layout.tsx, route.ts + that page's own .module.css
app/api/<domain>/route.ts → API endpoints, grouped by domain (inventory, sales, catalogue, webhooks/...)
components/<feature>/     → reusable components: ui/ layout/ inventory/ catalogue/ pos/ dashboard/
  ComponentName.tsx + ComponentName.module.css side by side, PascalCase names
lib/supabase/             → Supabase clients ONLY (client.ts = browser, server.ts = server)
lib/services/             → business logic / data-access functions shared by routes and pages
lib/                      → other shared helpers (e.g. razorpay.ts, formatting utils)
styles/globals.css        → design tokens + shared classes (single global stylesheet)
types/                    → shared TypeScript types (database.ts and friends)
```

### MUST rules

1. **No new top-level folders or root files** without explicit user instruction.
2. **Components are not created inside `app/`.** A reusable component (used by
   more than one page, or plausibly will be) goes in `components/<feature>/`.
   Only page-private helper JSX may stay inside the page file itself.
3. **Every `ComponentName.module.css` sits next to its `ComponentName.tsx`** —
   same folder, same base name. Page modules sit next to their `page.tsx`.
4. **Supabase access goes through `lib/supabase/client.ts` or `server.ts`.**
   No file creates its own Supabase client with `createClient(...)` directly.
5. **Shared logic lives in `lib/`.** If the same function/logic is written in
   two or more places in this session's diff, flag it — it belongs in
   `lib/services/` (data logic) or `lib/` (pure helpers).
6. **API routes only under `app/api/<domain>/route.ts`** — no fetch handlers
   or endpoint logic anywhere else.
7. **Shared types go in `types/`** — a type/interface used by more than one
   file must not be duplicated locally in each.

### SHOULD rules

8. Components use **PascalCase** filenames; route folders use **kebab-case**;
   lib files use kebab-case or camelCase consistently with neighbours.
9. New components go into the **matching feature folder** (`pos/` component in
   `components/pos/`, not `components/ui/`). `components/ui/` is only for
   generic, feature-agnostic building blocks.
10. Heavy business logic (multi-step calculations, transaction orchestration)
    SHOULD live in `lib/services/`, not inline in `page.tsx` or `route.ts` —
    routes/pages orchestrate, services compute.

## Step 3 — Report

Read `.claude/skills/_shared/report-format.md` and produce the report.
Report only — do not move or edit files.
