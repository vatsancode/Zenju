---
name: check-api-routes
description: Verify this session's API routes follow a consistent shape — correct HTTP status codes, one error format, input validation, no internal leaks. Use after adding or editing anything under app/api/.
---

# Check API Routes

Checks that this session's API route changes keep every endpoint predictable:
same request validation, same response shape, same error handling.

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect changed files.
This skill cares about: `app/api/**/route.ts`, `app/**/route.ts` (e.g. auth
callback), and `middleware.ts`.

## Step 2 — Rules

### The standard route shape

```ts
export async function POST(req: Request) {
  // 1. auth: verify session (401 if none)
  // 2. parse + validate input (400 with field errors if bad)
  // 3. authorize: does this user's business own this resource? (403/404)
  // 4. do the work via lib/services (500 on unexpected failure)
  // 5. return NextResponse.json(data, { status })
}
```

### MUST rules

1. **Auth first.** Every route that touches business data verifies the
   session server-side before doing anything. Unauthenticated → `401`.
2. **Validate input before use.** `await req.json()` must be wrapped in
   try/catch (malformed JSON → `400`) and its fields checked
   (types, required fields, positive quantities, valid enum values) → `400`
   with a clear message on failure.
3. **Correct status codes:** 200 read/update, 201 create, 400 bad input,
   401 unauthenticated, 403 forbidden, 404 not found, 500 unexpected.
   Never return 200 with `{ error: ... }` in the body.
4. **One error format across all routes.** Match the existing pattern in
   `app/api/` (e.g. `{ error: string }`); do not invent a new shape.
5. **No internal leaks.** Never send raw `error.message` / stack / SQL /
   Supabase error objects to the client for 500s — log server-side, return a
   generic message.
6. **Unexpected errors are caught.** No unhandled promise rejections — the
   route must always return a response.

### SHOULD rules

7. Business logic SHOULD live in `lib/services/`; the route handles HTTP
   concerns (auth, validation, status codes) and delegates.
8. Success responses for the same entity SHOULD have a consistent shape
   across GET/POST/PATCH.
9. Route files SHOULD only export HTTP method handlers (+ route config) —
   shared helpers go to `lib/`.
10. Mutating endpoints SHOULD reject unexpected extra fields rather than
    passing the whole body to the database.

## Step 3 — Report

Read `.claude/skills/_shared/report-format.md` and produce the report.
Report only — do not fix.
