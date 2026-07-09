# ZenJu

Inventory, catalogue, and POS management for small and medium retail shops in India
(dry fruit shops, bakeries, kirana stores). Built with Next.js 14 + Supabase + TypeScript.

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Plain CSS + CSS Modules — no Tailwind (see [docs/css-styleguide.md](docs/css-styleguide.md))
- Supabase — Auth, Postgres database, RLS
- Razorpay — billing
- Vercel — deployment

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase + Razorpay keys
3. In the Supabase SQL editor, run the migration(s) in `supabase/migrations/` in order
4. `npm run dev` — app runs at http://localhost:3000

## Documentation

Start with [docs/architecture.md](docs/architecture.md) — it maps every folder to its
purpose and is the fastest way to find where something lives.

| Doc | What's in it |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Folder map, domain-to-code conventions, current build status |
| [docs/database-schema.md](docs/database-schema.md) | All 24 tables, relationships, indexes, RLS — source of truth for the database |
| [docs/css-styleguide.md](docs/css-styleguide.md) | Design tokens, component classes, CSS Modules conventions |
| [docs/decisions/](docs/decisions/) | Short records of why non-obvious choices were made (local only, not committed) |
| [docs/archive/](docs/archive/) | Superseded documents kept for historical context only |

## Current Status

See the "Current status" section at the bottom of
[docs/architecture.md](docs/architecture.md#current-status-update-this-section-as-it-changes)
for what's wired up vs. still using mock data.
