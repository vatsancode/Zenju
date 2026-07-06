---
name: check-schema-alignment
description: Verify this session's database code matches SCHEMA_CONCLUSION.md — real table/column names, soft-delete filters, snapshot rules, tenancy columns. Use after writing any Supabase query or migration.
---

# Check Schema Alignment

Cross-checks this session's queries and types against `SCHEMA_CONCLUSION.md`
(the single source of truth for database design). If in doubt, re-read the
relevant table section in that file before flagging.

## Step 1 — Scope

Read `.claude/skills/_shared/diff-scope.md` and collect changed files.
This skill cares about: `*.ts`, `*.tsx` containing `.from(`, `.rpc(`, or SQL;
plus `types/database.ts` and any migration/SQL files.

## Step 2 — Rules

### MUST rules

1. **Every table and column referenced must exist in SCHEMA_CONCLUSION.md.**
   Verify each `.from('...')`, `.select('...')`, `.eq('...')`, insert/update
   payload key against the doc. Typos and invented columns are failures.
2. **No new tables or columns** invented in code without the schema doc being
   updated first (flag → also relevant to /update-docs).
3. **Multi-tenancy:** every query on a tenant-owned table filters by
   `business_id` (directly or provably via RLS + authenticated client).
   Never query tenant data unscoped.
4. **Soft delete:** queries for active records on `inventory_items`,
   `catalogue_items`, `offers`, `customers` must filter
   `deleted_at IS NULL`; "deletes" of these set `deleted_at`, never hard-delete.
5. **Append-only tables:** no UPDATE or DELETE on `stock_movements` or
   `event_log`.
6. **Snapshot rule:** `sale_items` writes must snapshot
   `catalogue_item_name`, `unit_price`, `cost_price_at_sale`, `tax_amount`,
   `tax_breakdown` at sale time — never join back to live tables for
   historical values, and never update snapshots afterwards.
7. **Stock is derived:** current stock comes from the `variant_stock_current`
   view / SUM of `inventory_batches.quantity_remaining`. Code must not store
   or directly update a `current_stock` column.
8. **FK rules:** units via `unit_id` and categories via `category_id`
   (never free-text unit/category strings in data rows).
9. **Enum-ish values match the doc exactly:** e.g. `sales.status` ∈
   draft/completed/voided/refunded; `payment_method` ∈ cash/upi/card;
   `movement_type` ∈ sale/purchase/manual_adjustment/waste;
   `catalogue_items.type` ∈ linked/bundle/independent.

### SHOULD rules

10. Queries use generated/shared types from `types/database.ts` — no `any`
    row shapes for known tables; if a table is missing from `types/database.ts`,
    flag it.
11. Queries on `sales`, `stock_movements`, `event_log` SHOULD include a
    `created_at` date-range filter (partitioning guidance in the schema doc).
12. Multi-write operations that must succeed together (sale + sale_items +
    stock movements) SHOULD go through a single RPC/transaction, not separate
    client calls.

## Step 3 — Report

Read `.claude/skills/_shared/report-format.md` and produce the report.
Report only — do not fix.
