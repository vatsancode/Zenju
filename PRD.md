# PRD.md — SmartInventory AI (v1)
> This is the single source of truth for WHAT to build in v1.
> Paste this into every Claude session alongside SCHEMA.md.
> Do NOT build anything listed under "Out of Scope for v1."

---

## 1. Product Overview

**Product Name:** SmartInventory AI
**Version:** v1 (Web App only — no WhatsApp)
**Market:** India-first, English + regional language support
**Target Users:** Small business owners — dry fruit/snack shops, restaurants, cloud kitchens, kirana stores, retail shops, and any service provider who needs to track sales and stock.
**Core Promise:** The simplest way for a small business owner to manage inventory, build a product catalogue, record sales, and see their profit — all in one place.

---

## 2. User Persona

**Primary User: The Small Business Owner**
- Non-technical, possibly not comfortable with complex software
- Manages their shop alone or with 1–2 staff
- Needs speed — recording a sale should take under 10 seconds
- Works on mobile and desktop both
- Speaks English but may prefer regional language
- Pain points: doesn't know real-time profit, loses track of stock, wastes time on manual calculations

---

## 3. Business Model — Freemium

| Plan | Limits | Price |
|---|---|---|
| **Free** | Max 50 inventory items, Max 30 catalogue items, Basic dashboard only | ₹0 forever |
| **Pro** | Unlimited inventory + catalogue, Full analytics dashboard | Paid (monthly / yearly via Stripe) |

**Free plan is generous enough to get value, limited enough to convert.**

---

## 4. Architecture Decisions

- **Frontend:** Next.js (React) + Plain CSS + CSS Modules (no Tailwind)
- **Styling:** globals.css (design tokens + shared classes) + per-component CSS Modules
- **Font:** Inter (Google Fonts)
- **Style Reference:** STYLEGUIDE.md — Claude must read this before writing any UI code
- **Backend + Database + Auth:** Supabase
- **Payments:** Stripe
- **Deployment:** Vercel
- **Auth Methods:** Email/password + Google OAuth
- **Currency:** Indian Rupee (₹) throughout v1
- **Branch Scope:** v1 = single branch per account. Schema must be branch-aware for future multi-branch support but only one branch is active in v1.
- **Language:** English UI with regional language support (architecture must support i18n from day one even if only English ships first)

---

## 5. Modules — v1 Scope

---

### Module 1: Authentication

**What it does:**
- User can sign up with email + password
- User can sign up / log in with Google (OAuth)
- User can log out
- Protected routes — unauthenticated users redirected to login
- On first login, user completes a short onboarding (business name, category)

**What it does NOT do in v1:**
- No phone/OTP login
- No password reset (push to v1.1)
- No team/staff invites (v2 — RBAC)

---

### Module 2: Inventory Management

**What it does:**
- Add a new inventory item (name, category, unit, cost price, MRP, par stock, notes, availability status)
- View all inventory items in a list/table with search and filter by category
- Edit any inventory item's details
- Mark an item as out of stock or discontinued
- Record stock arrival (purchase) — increases current_stock, logs to stock_movements
- Record waste or consumption — decreases current_stock, logs to stock_movements
- Low stock alert — visually flag items where current_stock ≤ par_stock
- Show real-time Inventory Worth = SUM(current_stock × cost_price) across all items

**Free plan limit:** Max 50 inventory items. Show upgrade prompt when limit is reached.

**What it does NOT do in v1:**
- No supplier management (supplier_id column reserved but unused)
- No bulk import via CSV (v2)
- No barcode scanning (v2)

---

### Module 3: Catalogue Builder

**What it does:**
- Add a new catalogue item with name, category, selling price, and availability status
- Define whether item is Simple (maps to 1 inventory item) or Bundle (maps to multiple)
- For Simple items: select 1 inventory item and set quantity used per sale
- For Bundles: select multiple inventory items and set quantity used per sale for each (the "recipe")
- View all catalogue items with search and filter
- Edit catalogue items and their component recipes
- Mark catalogue items as active or inactive

**Free plan limit:** Max 30 catalogue items. Show upgrade prompt when limit reached.

**What it does NOT do in v1:**
- No catalogue item images (v2)
- No item-level tax settings (v2)
- No categories management screen (categories are free-text in v1)

---

### Module 4: Quick-Tap POS

**What it does:**
- Grid of active catalogue items — tap to add to current sale
- Adjust quantity per item in the sale
- Override selling price per item (custom pricing per sale)
- Apply item-level discount (per line item)
- Apply bill-level discount (on total)
- Select payment method: Cash / UPI / Card
- Add optional note to the transaction
- "Confirm Sale" button — triggers:
  1. Creates row in `sales`
  2. Creates rows in `sale_items`
  3. Looks up `catalogue_components` for each item
  4. Creates `stock_movements` rows (type: sale_deduction)
  5. Updates `current_stock` in `inventory_items`
- After sale: show confirmation screen with sale summary (items, total, payment method)
- Confirmation screen has a "New Sale" button to reset and start again

**What it does NOT do in v1:**
- No printable / shareable bill (v2 — WhatsApp-friendly bill)
- No hold/park sale feature (v2)
- No returns / refunds (v2)
- No customer selection at POS (v2)

---

### Module 5: Dashboard

**What it shows on login (always visible, free + paid):**
- Today's Revenue (total final_amount for today)
- Today's Profit (simple items only — bundles excluded in v1)
- Low Stock Alerts (items where current_stock ≤ par_stock) — list with item name + current stock
- Top 5 Selling Items (by quantity sold, all time or this month)

**Advanced Analytics (Pro plan only):**
- Revenue by time period (daily / weekly / monthly) — line or bar chart
- Profit by time period
- Profit by catalogue category
- Payment method split (Cash vs UPI vs Card) — pie chart
- Inventory worth over time
- Top selling time / day of week analysis
- Sales transaction history with filters (date range, payment method, item)
- Waste log history

**Free plan behaviour:** Advanced analytics section is visible but blurred/locked with an upgrade prompt. Do not hide it — show it locked so user knows what they're missing.

---

## 6. Navigation Structure (Web App)

```
Sidebar Navigation:
├── Dashboard          (home screen)
├── Inventory          (inventory items list + add/edit)
├── Catalogue          (catalogue items list + add/edit with bundle builder)
├── POS                (quick-tap sales screen)
├── Sales History      (transaction log — Pro feature)
└── Settings
    ├── Business Profile
    ├── Subscription & Billing
    └── Language
```

---

## 7. UI/UX Principles

- **Colorful and friendly** — designed for non-tech users, not enterprise software
- **Mobile-responsive** — POS in particular must work well on a phone/tablet
- **Speed over features** — recording a sale must be fast (under 3 taps ideally)
- **Indian context** — currency is ₹, payment options include UPI prominently
- **Clear feedback** — every action (sale recorded, stock updated, item added) must show a visible success/error message
- **Progressive disclosure** — show simple things first, advanced settings tucked away

---

## 8. User Flows

### New User Flow:
1. Land on marketing/landing page
2. Click "Get Started Free"
3. Sign up (email or Google)
4. Onboarding: enter business name + category
5. Redirected to Dashboard (empty state with prompts to add inventory)

### Daily Operations Flow:
1. Log in → see Dashboard (today's summary + alerts)
2. Record sales throughout the day via POS
3. Log stock arrivals or waste in Inventory when needed
4. Check Dashboard for end-of-day summary

### Catalogue Setup Flow (one-time):
1. Go to Inventory → Add raw items
2. Go to Catalogue → Add sellable items
3. For each catalogue item → map to inventory components (simple or bundle)
4. Catalogue is now ready for POS

---

## 9. Freemium Limit Enforcement

| Trigger | Behaviour |
|---|---|
| User tries to add 51st inventory item (free plan) | Show modal: "You've reached the free limit of 50 items. Upgrade to Pro for unlimited inventory." |
| User tries to add 31st catalogue item (free plan) | Show modal: "Upgrade to Pro for unlimited catalogue items." |
| User tries to access locked analytics (free plan) | Show blurred preview + "Upgrade to Pro to unlock full analytics." |

**Rule for Claude:** Always check `subscription_plan` from the `users` table before allowing limit-sensitive actions.

---

## 10. What is Explicitly OUT OF SCOPE for v1

Claude must NEVER build these in v1, even if it seems logical to add them:

| Feature | Reason | Version |
|---|---|---|
| WhatsApp integration | Core v2 feature — entire NLP engine | v2 |
| Supplier management | Separate module, supplier table not built | v2 |
| Customer management / credit | Separate module, customer table not built | v2 |
| Staff / team accounts (RBAC) | Multi-user permissions not designed yet | v2 |
| Printable / shareable bill | Post-sale flow enhancement | v2 |
| Bulk CSV import | Nice to have, not core | v2 |
| Barcode scanning | Hardware dependency | v2 |
| Returns / refunds | Complex reversal logic | v2 |
| Multi-branch management | Single branch only in v1 | v2 |
| Bundle-level profit calculation | Complex component-level apportioning | v2 |
| Advanced tax / GST settings | Regulatory complexity | v2 |
| Item images in catalogue | Storage + UX complexity | v2 |
| Sales holds / parking | POS enhancement | v2 |

---

## 11. Build Order for Claude (Phase by Phase)

Build strictly in this order. Do not jump ahead.

```
Phase 1 — Foundation
  └── Project setup: Next.js + Supabase + Plain CSS + Vercel connected

Phase 2 — Auth
  └── Email/password signup + login
  └── Google OAuth
  └── Onboarding screen (business name + category)
  └── Protected routes

Phase 3 — Inventory Module
  └── Supabase tables: inventory_items + stock_movements
  └── Add / Edit inventory item
  └── Record stock arrival (purchase)
  └── Record waste / consumption
  └── Inventory list with search + filter
  └── Low stock alert display

Phase 4 — Catalogue Module
  └── Supabase tables: catalogue_items + catalogue_components
  └── Add simple catalogue item (1:1 mapping)
  └── Add bundle catalogue item (many:1 mapping with recipe builder)
  └── Catalogue list with search + filter
  └── Edit catalogue item + its components

Phase 5 — POS Module
  └── Quick-tap sale screen (grid of catalogue items)
  └── Cart logic (add, adjust qty, remove)
  └── Price override + item discount + bill discount
  └── Payment method selection
  └── Confirm Sale — full transaction logic (sales + sale_items + stock_movements + update current_stock)
  └── Sale confirmation screen

Phase 6 — Dashboard
  └── Today's revenue + profit (simple items)
  └── Low stock alerts widget
  └── Top 5 selling items
  └── Pro analytics (locked/blurred for free users)

Phase 7 — Subscription & Billing
  └── Stripe integration
  └── Free plan limit enforcement
  └── Upgrade prompts
  └── Subscription management screen
```

---

## 12. Key Rules Claude Must Always Follow

1. **Always check SCHEMA.md** before writing any database query or migration
2. **Never deviate from the 7-table schema** — do not create new tables without explicit instruction
3. **Always use `user_id` on every query** — every piece of data belongs to a user, never query without filtering by user
4. **`cost_price_at_sale` must always be a snapshot** — copy from inventory at time of sale, never reference live cost_price
5. **Bundle sale deductions must be atomic** — all stock_movements rows for a sale must succeed or all must fail (use Supabase transactions)
6. **Free plan limits must be checked server-side** — never trust only the frontend
7. **`current_stock` is updated via stock_movements** — never update it directly, always go through the movement log
8. **Branch-aware from day one** — even though v1 is single branch, always include `branch_id` as a reserved column for future

---

*Last updated: SmartInventory AI — PRD v1 Final — synced with SCHEMA.md + STYLEGUIDE.md v1*
