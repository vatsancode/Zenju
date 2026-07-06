---
name: check-security
description: Security review of this session's changes — secrets exposure, auth on protected paths, Razorpay webhook verification, server-side trust of client data, RLS assumptions. Use after writing auth, payment, API, or data-access code.
---

# Check Security

Security check of this session's changes. This app handles money (Razorpay)
and multi-tenant business data (Supabase) — treat every finding here seriously.

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect changed files.
This skill cares about: `*.ts`, `*.tsx`, `middleware.ts`, `.env*`,
`next.config.*`, `package.json`.

## Step 2 — Rules

### MUST rules — secrets

1. **No secrets in client code.** `SUPABASE_SERVICE_ROLE_KEY`,
   `RAZORPAY_KEY_SECRET`, or any non-`NEXT_PUBLIC_` env var must never be
   referenced in a client component (`'use client'`), a `components/` file
   rendered client-side, or anything imported by one. Only
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
   `NEXT_PUBLIC_RAZORPAY_KEY_ID` may reach the browser.
2. **No hardcoded credentials/keys/tokens anywhere** — including in comments,
   test data, or `.env` files being committed.
3. **Server-only modules stay server-only:** `lib/supabase/server.ts` and
   `lib/razorpay.ts` must never be imported from client components.

### MUST rules — auth & tenancy

4. **Protected routes are actually protected.** New pages under
   `app/dashboard/` and `app/admin/` rely on `middleware.ts` coverage —
   verify the matcher covers new paths. New `app/api/` routes must verify the
   session server-side; never trust that "the UI only shows this to
   logged-in users".
5. **Never trust a client-sent `business_id` / `user_id`.** Identity comes
   from the server-side session; tenancy scoping from the authenticated
   user's business. A request body saying `business_id: X` is not proof.
6. **RLS assumption stated.** Any new query path must note (code comment or
   report) whether it relies on RLS or explicit filtering — silent assumptions
   are findings.

### MUST rules — payments & money

7. **Razorpay webhook signature must be verified** (HMAC of raw body with
   the webhook secret) before processing any webhook event. Handler must not
   trust the payload otherwise.
8. **Never trust client-sent prices, totals, discounts, or stock quantities.**
   The POS confirm-sale flow must recompute prices server-side from
   `catalogue_items.selling_price` and validate quantities/discount bounds.
   Client sends item ids + quantities; server computes money.
9. **Plan limits enforced server-side** (free = 50 inventory / 30 catalogue) —
   a UI-only check is a failure (PRD rule 6).

### SHOULD rules

10. API errors SHOULD not leak internals (stack traces, SQL, key names) to
    the client.
11. User-supplied strings rendered in UI SHOULD rely on React escaping —
    flag any `dangerouslySetInnerHTML`.
12. Redirect targets from query params SHOULD be validated
    (open-redirect risk in auth callbacks).
13. New dependencies SHOULD be justified — flag additions to package.json
    with unclear purpose.

## Step 3 — Report

Read `.claude/skills/_shared/report-format.md` and produce the report.
Report only — do not fix. If a MUST secrets finding involves a real leaked
value, say WHERE it is but never repeat the value itself in the report.
