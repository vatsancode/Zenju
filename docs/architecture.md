# Architecture Map — ZenJu

> Read this file first, before grepping the codebase. It exists so an AI agent (or a new
> developer) can find the right file in one lookup instead of reading through folders.
> Keep this file short — if it starts explaining *how* something works instead of *where*
> it lives, that content belongs in the file itself or in [database-schema.md](./database-schema.md).

## Where things live

| I need to... | Go to |
|---|---|
| Understand a database table | [database-schema.md](./database-schema.md) |
| Understand a CSS class / styling rule | [css-styleguide.md](./css-styleguide.md) |
| See a route's page code | `app/<route>/page.tsx` |
| See a route's layout (shared wrapper) | `app/<route>/layout.tsx` |
| See or add an API endpoint | `app/api/<name>/route.ts` |
| See or add a Supabase browser query | `lib/supabase/client.ts` |
| See or add a Supabase server-side query | `lib/supabase/server.ts` |
| See the Edge Middleware Supabase client (Edge runtime can't use next/headers) | `lib/supabase/middleware.ts` |
| Check if the current user is a super-admin | `lib/supabase/admin.ts` |
| Add business logic that talks to Supabase | `lib/services/<domain>.ts` (never call Supabase directly from a page/component) |
| Add a formatter/helper (currency, dates, etc.) | `lib/utils/` |
| Add a business rule constant (plan limits, pricing) | `lib/constants/` |
| Add a reusable UI piece used by 2+ pages | `components/<domain>/` |
| Add a custom React hook | `hooks/` |
| Check what a table's TypeScript shape looks like | `types/database.ts` |
| Add/change a database table | new file in `supabase/migrations/`, then update `types/database.ts` and `docs/database-schema.md` |
| Understand why a past decision was made | `docs/decisions/` (local only, gitignored — ask if missing) |

## Domain-to-folder map

Each business domain has a consistent shape across pages, components, and services:

```
app/dashboard/<domain>/page.tsx        ← the page
components/<domain>/                   ← reusable pieces for that page
lib/services/<domain>.ts               ← Supabase queries for that domain
```

Domains: `inventory`, `catalogue` (includes `offers`), `pos`, `sales`, `settings`.

`auth` follows the same shape but lives at `app/auth/` (public, outside the dashboard shell).

## Request flow (how a page gets data)

```
Page (Server or Client Component)
  → lib/services/<domain>.ts   (business logic, one function per operation)
    → lib/supabase/client.ts   (browser) or lib/supabase/server.ts (server)
      → Supabase (RLS-enforced, business_id-scoped)
```

Pages and components must never call `lib/supabase/*` directly — always through a service
function in `lib/services/`. This keeps query logic in one place per domain instead of
scattered across components.

## Current status (update this section as it changes)

- Auth pages: login wired to real Supabase Auth (email/password sign-in + admin_users/business_users role routing); signup, forgot-password, reset-password, and onboarding still stubbed with TODOs
- Dashboard pages: UI built, running on `lib/mock-data.ts` — not yet wired to real tables
- Database: migrations `001_initial_schema.sql`, `002_business_types.sql`, `003_admin_users.sql` applied, 26 tables + 1 view live in Supabase
- `lib/services/`: `auth.ts` added (login role routing) — everything else still empty, added domain by domain as pages are wired up
