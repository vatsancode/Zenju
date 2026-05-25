# PROMPTS.md — SmartInventory AI (v1)
> Ready-made prompts for Claude Code in VS Code.
> Every prompt is self-contained — just copy, paste, and send.
> Always complete one prompt fully before moving to the next.
> Last synced with: PRD.md v1 Final + SCHEMA.md v1 Final + STYLEGUIDE.md v1 Final

---

## HOW TO USE THIS FILE

1. Open Claude Code in VS Code terminal
2. Find the prompt for your current phase/task
3. Copy the entire prompt block including the context section
4. Paste it into Claude Code and press Enter
5. Wait for Claude to finish completely before sending the next prompt
6. Test manually after every prompt before moving on
7. If something breaks, use the BUG FIX PROMPTS section at the bottom

---

## GOLDEN RULES (read once, remember always)

- One prompt = one task. Never combine two tasks in one prompt.
- Always test before continuing. If step 3 works, test it before doing step 4.
- If Claude goes off-track, paste the RESET CONTEXT prompt below, then retry.
- Never skip a phase. Each phase builds on the previous one.
- Commit working code after every completed prompt: git add . && git commit -m "describe what was built"

---

## RESET CONTEXT PROMPT
Use this at the start of any new Claude Code session, or when Claude seems confused.

---COPY FROM HERE---

You are helping me build SmartInventory AI, a B2B SaaS inventory and POS platform for small businesses in India.

STRICT RULES YOU MUST FOLLOW:
- Tech stack: Next.js 14 (App Router) + TypeScript + Plain CSS + CSS Modules + Supabase + Razorpay + Vercel
- Currency is Indian Rupee (Rs.) throughout
- Database has exactly 7 tables: users, inventory_items, catalogue_items, catalogue_components, sales, sale_items, stock_movements
- Never create new tables without my explicit instruction
- Always filter every Supabase query by user_id
- Never update current_stock directly, always go via stock_movements
- Free plan limits: 50 inventory items, 30 catalogue items, checked server-side
- branch_id is reserved on all tables for v2, include it as a nullable column but do not use it in v1 logic

DATABASE CONNECTION RULE (critical for scaling):
- Always use the Supabase POOLED connection string (Pgbouncer SESSION mode) for all database operations
- Store it as SUPABASE_DB_POOLED_URL in .env.local
- Never use the direct connection string for application queries

SERVICE LAYER RULE (critical for maintainability):
- Never call Supabase directly from components or pages
- All database queries must live in service functions inside /lib/services/
- Example: /lib/services/inventory.ts, /lib/services/sales.ts, /lib/services/catalogue.ts
- Components call service functions, service functions call Supabase

SALE CONFIRMATION FLOW RULE (critical for performance):
- The sale confirmation must use a Supabase RPC (stored procedure) NOT a plain TypeScript API route
- The RPC handles: stock checks, sale insert, sale_items insert, stock_movements insert, current_stock update — all in one database call
- Partial sales are ALLOWED: if stock is insufficient for an item, still record the sale but set stock_deducted = false on that sale_item and skip the stock deduction for that item only
- Always return which items were flagged for stock shortfall so the UI can warn the owner

CSS & STYLING RULES (critical — read before writing any UI code):
- There is NO Tailwind in this project. Do not write Tailwind classes. Do not install Tailwind.
- All styles come from two places only:
  1. /styles/globals.css — shared classes, imported once in /app/layout.tsx
  2. ComponentName.module.css — component-specific layout styles only
- Use globals.css class names directly in className: "btn btn--primary", "card", "alert alert--warning"
- For component-specific styles: import styles from './Component.module.css' and use styles.className
- Never hardcode hex colors for text or backgrounds — always use CSS variables: var(--color-text-primary), var(--color-bg-secondary) etc.
- Inline styles are ONLY allowed for dynamic runtime values: style={{ width: percentage + '%' }}
- Currency must always be formatted using Indian number format: Intl.NumberFormat('en-IN')

Acknowledge these rules and confirm you are ready.

---COPY TO HERE---

---

---

# PHASE 1 - PROJECT SETUP

---

## Prompt 1.1 - Initialize the Project

---COPY FROM HERE---

You are helping me build SmartInventory AI, a B2B SaaS inventory and POS platform for small businesses in India.

Tech stack: Next.js 14 App Router + TypeScript + Plain CSS + CSS Modules + Supabase + Razorpay + Vercel

Task: Set up the project from scratch. Do the following in order:

1. Create a new Next.js 14 project with TypeScript and App Router enabled. Do NOT install or configure Tailwind CSS.
2. Install these dependencies: @supabase/supabase-js @supabase/ssr razorpay
   Do NOT install tailwindcss, postcss, autoprefixer, stripe, or any CSS framework.
3. Create a .env.local file with placeholder keys for:
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_RAZORPAY_KEY_ID
   RAZORPAY_KEY_SECRET
   RAZORPAY_WEBHOOK_SECRET
   NEXT_PUBLIC_APP_URL
4. Create /lib/supabase/client.ts (browser Supabase client using @supabase/ssr)
5. Create /lib/supabase/server.ts (server-side Supabase client using @supabase/ssr)
6. Create /lib/razorpay.ts with the Razorpay client initialization using the razorpay npm package
7. Set up folder structure:
   /app/auth (login, signup pages)
   /app/dashboard (protected pages)
   /app/api (API routes)
   /components/ui (reusable UI)
   /components/layout (sidebar, navbar)
   /lib (supabase, razorpay clients)
   /types (TypeScript types)
8. Create /types/database.ts with TypeScript interfaces for all 7 tables using this exact schema:

users: id(uuid), name(text), email(text), business_name(text), subscription_plan(text: free or pro), preferred_language(text default en), created_at(timestamp), role(text nullable), branch_id(uuid nullable), razorpay_customer_id(text nullable)

inventory_items: id(uuid), user_id(uuid), name(text), category(text), unit(text), current_stock(decimal), par_stock(decimal), cost_price(decimal), mrp(decimal), availability_status(text: active or out_of_stock or discontinued), notes(text nullable), created_at(timestamp), supplier_id(uuid nullable), branch_id(uuid nullable)

catalogue_items: id(uuid), user_id(uuid), name(text), category(text), selling_price(decimal), is_bundle(boolean), availability_status(text: active or inactive), notes(text nullable), created_at(timestamp), branch_id(uuid nullable)

catalogue_components: id(uuid), catalogue_item_id(uuid), inventory_item_id(uuid), quantity_used(decimal)

sales: id(uuid), user_id(uuid), subtotal_amount(decimal), bill_discount_amount(decimal default 0), final_amount(decimal), payment_method(text: cash or upi or card), sold_at(timestamp), notes(text nullable), customer_id(uuid nullable), branch_id(uuid nullable)

sale_items: id(uuid), sale_id(uuid), catalogue_item_id(uuid), quantity(decimal), unit_price(decimal), cost_price_at_sale(decimal), item_discount_amount(decimal default 0), line_total(decimal), is_bundle(boolean), stock_deducted(boolean default true)

stock_movements: id(uuid), user_id(uuid), inventory_item_id(uuid), movement_type(text: purchase or waste or consumption or sale_deduction), quantity(decimal), notes(text nullable), created_at(timestamp), branch_id(uuid nullable)

After completing setup, show me the full folder structure and confirm all files are created.

---COPY TO HERE---

---

## Prompt 1.2 - Supabase Database Migration

---COPY FROM HERE---

You are helping me build SmartInventory AI.

Task: Create the Supabase SQL migration file to set up all 7 database tables.

Create the file at /supabase/migrations/001_initial_schema.sql

The SQL must:

1. Enable UUID extension: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

2. Create all 7 tables with these exact columns:

TABLE users:
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
name TEXT NOT NULL,
email TEXT UNIQUE NOT NULL,
business_name TEXT,
subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free','pro')),
preferred_language TEXT DEFAULT 'en',
created_at TIMESTAMPTZ DEFAULT NOW(),
role TEXT,
branch_id UUID,
razorpay_customer_id TEXT

TABLE inventory_items:
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
name TEXT NOT NULL,
category TEXT,
unit TEXT NOT NULL,
current_stock DECIMAL DEFAULT 0,
par_stock DECIMAL DEFAULT 0,
cost_price DECIMAL DEFAULT 0,
mrp DECIMAL DEFAULT 0,
availability_status TEXT DEFAULT 'active' CHECK (availability_status IN ('active','out_of_stock','discontinued')),
notes TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
supplier_id UUID,
branch_id UUID

TABLE catalogue_items:
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
name TEXT NOT NULL,
category TEXT,
selling_price DECIMAL DEFAULT 0,
is_bundle BOOLEAN DEFAULT false,
availability_status TEXT DEFAULT 'active' CHECK (availability_status IN ('active','inactive')),
notes TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
branch_id UUID

TABLE catalogue_components:
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
catalogue_item_id UUID NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
quantity_used DECIMAL NOT NULL

TABLE sales:
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
subtotal_amount DECIMAL NOT NULL DEFAULT 0,
bill_discount_amount DECIMAL DEFAULT 0,
final_amount DECIMAL NOT NULL DEFAULT 0,
payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','upi','card')),
sold_at TIMESTAMPTZ DEFAULT NOW(),
notes TEXT,
customer_id UUID,
branch_id UUID

TABLE sale_items:
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
catalogue_item_id UUID NOT NULL REFERENCES catalogue_items(id) ON DELETE RESTRICT,
quantity DECIMAL NOT NULL,
unit_price DECIMAL NOT NULL,
cost_price_at_sale DECIMAL NOT NULL,
item_discount_amount DECIMAL DEFAULT 0,
line_total DECIMAL NOT NULL,
is_bundle BOOLEAN DEFAULT false,
stock_deducted BOOLEAN DEFAULT true

TABLE stock_movements:
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase','waste','consumption','sale_deduction')),
quantity DECIMAL NOT NULL,
notes TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
branch_id UUID

3. Enable Row Level Security (RLS) on all tables and add SELECT, INSERT, UPDATE, DELETE policies using auth.uid() = user_id for all user-owned tables

4. Add indexes on: inventory_items(user_id), catalogue_items(user_id), sales(user_id), sales(sold_at), stock_movements(user_id), stock_movements(inventory_item_id)

Show me the complete SQL file. Do not run it, just create the file.

---COPY TO HERE---

---

## Prompt 1.3 - Basic Layout Shell

---COPY FROM HERE---

You are helping me build SmartInventory AI, a colorful friendly SaaS for small business owners in India.

Task: Create the main app layout with a sidebar navigation shell. This is visual structure only, no data yet.

UI style: Colorful and friendly. Primary color #1E3A5F (deep blue). Accent color #2E86AB (bright blue). Use globals.css classes only — no Tailwind. Mobile responsive.

CSS approach for this prompt:
- Use globals.css classes for all shared styles: sidebar, nav-item, nav-item__bar etc.
- Create /components/layout/Sidebar.module.css for any Sidebar-specific layout only
- Create /components/layout/TopBar.module.css for any TopBar-specific layout only
- Never write Tailwind classes

Create these files:

1. /components/layout/Sidebar.tsx
   - Logo at top: "SmartInventory AI" text with a box icon
   - Navigation links with emoji placeholder icons:
     Dashboard (home icon)
     Inventory (box icon)
     Catalogue (tag icon)
     POS (screen icon)
     Sales History (with "Pro" badge)
     Settings (gear icon)
   - Bottom: user business name + free/pro badge
   - Active link highlighted with accent color
   - Collapses to icons only on mobile

2. /components/layout/TopBar.tsx
   - Dynamic page title on left
   - User avatar with initials + dropdown (Profile, Logout) on right

3. /app/dashboard/layout.tsx
   - Combines Sidebar and TopBar
   - Main content area with proper padding
   - Wraps all protected dashboard pages

4. /app/dashboard/page.tsx
   - Placeholder empty state card: "Dashboard coming soon"

Show me all files with complete code.

---COPY TO HERE---

---

---

# PHASE 2 - AUTHENTICATION

---

## Prompt 2.1 - Signup Page

---COPY FROM HERE---

You are helping me build SmartInventory AI, a B2B SaaS for small business owners in India.
Tech stack: Next.js 14 App Router + TypeScript + Plain CSS + CSS Modules + Supabase Auth

CSS: Use globals.css classes (form-group, form-label, form-input, btn btn--primary, alert alert--danger).
Create /app/auth/auth.module.css for page-level layout (centering, card sizing) only.

Task: Build the Signup page at /app/auth/signup/page.tsx

Requirements:
1. Email + password signup with fields: Full Name, Email, Password, Confirm Password
2. Google OAuth signup button "Continue with Google"
3. After email signup success, redirect to /auth/onboarding
4. After Google signup, check if user exists in users table. If yes redirect to /dashboard. If no redirect to /auth/onboarding
5. Show clear errors for: email already exists, password too short (min 8 chars), passwords do not match
6. Show loading spinner on button during request
7. Link at bottom: "Already have an account? Log in"

Supabase methods:
- Email: supabase.auth.signUp({ email, password, options: { data: { name } } })
- Google: supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/callback' } })

Also create:
- /app/auth/callback/route.ts to handle OAuth redirect and exchange code for session
- /app/auth/layout.tsx for centered card layout for all auth pages

UI: Brand colors (#1E3A5F, #2E86AB). Clean centered card. Welcoming tagline above the form.

Show me all files with complete code.

---COPY TO HERE---

---

## Prompt 2.2 - Login Page

---COPY FROM HERE---

You are helping me build SmartInventory AI.

Task: Build the Login page at /app/auth/login/page.tsx

Requirements:
1. Email + password login form
2. Google OAuth login button
3. After successful login redirect to /dashboard
4. Show error for: invalid credentials, unverified email
5. Loading state on button
6. Link: "Don't have an account? Sign up"
7. "Forgot password?" link placeholder pointing to /auth/forgot-password

Supabase methods:
- Email: supabase.auth.signInWithPassword({ email, password })
- Google: supabase.auth.signInWithOAuth({ provider: 'google' })

UI: Same centered card style as signup page. Brand colors. Friendly tone.

Show me the complete file.

---COPY TO HERE---

---

## Prompt 2.3 - Onboarding Screen

---COPY FROM HERE---

You are helping me build SmartInventory AI.

Task: Build the onboarding screen at /app/auth/onboarding/page.tsx

This screen appears once after a new user signs up for the first time.

Requirements:
1. Form with two fields:
   - Business Name (text input, required)
   - Business Category (dropdown: Dry Fruit / Snack Shop, Restaurant / Cloud Kitchen, Kirana / Retail Store, Service Provider, Other)
2. On submit:
   - Insert into users table: id = auth.uid(), name from signup metadata, email, business_name from form, subscription_plan = 'free', preferred_language = 'en'
   - Redirect to /dashboard
3. If user already has a row in the users table, skip this page and redirect to /dashboard
4. Warm welcome message: "Let's set up your business! This takes 30 seconds."
5. Loading state on submit button

Supabase: use server client to insert, use auth.getUser() for id, name, email.

UI: Full page with brand colors. Warm and welcoming, not a boring form.

Show me the complete file.

---COPY TO HERE---

---

## Prompt 2.4 - Protected Routes Middleware

---COPY FROM HERE---

You are helping me build SmartInventory AI.

Task: Create Next.js middleware to protect all dashboard routes.

Create /middleware.ts at project root:
1. Any route starting with /dashboard: check for valid Supabase session. No session = redirect to /auth/login
2. If logged-in user visits /auth/login or /auth/signup: redirect to /dashboard
3. Public routes: /, /auth/login, /auth/signup, /auth/callback, /auth/onboarding
4. Use @supabase/ssr to read session from cookies

Also create /hooks/useUser.ts:
- Returns the current user's data from the users table (not just auth user)
- Returns loading state
- Usable in any client component

Show me complete code for both files.

---COPY TO HERE---

---

---

# PHASE 3 - INVENTORY MODULE

---

## Prompt 3.1 - Inventory List Page

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs. (Indian Rupee).

Task: Build the Inventory list page at /app/dashboard/inventory/page.tsx

Requirements:
1. Fetch all inventory_items where user_id = current user, ordered by created_at DESC
2. Display as a table with columns: Name, Category, Unit, Current Stock, Par Stock, Cost Price, MRP, Status, Actions
3. Row colors:
   - current_stock <= par_stock: highlight in soft red (low stock warning)
   - availability_status = discontinued: gray out the row
4. Search bar to filter by item name (client-side)
5. Filter dropdown by category
6. Filter dropdown by availability_status
7. "Add Item" button top right to open Add Item form
8. Show total Inventory Worth at top: SUM(current_stock x cost_price) formatted in Indian number format
9. Empty state: friendly message + "Add your first inventory item" button

Freemium rule: If subscription_plan = 'free' AND item count >= 50, show banner:
"You've reached the free limit of 50 items. Upgrade to Pro for unlimited inventory."

Each row actions:
- Edit (pencil icon) opens edit form
- Stock Arrival (plus icon) opens stock arrival modal
- Record Waste (trash icon) opens waste modal

Use types from /types/database.ts.
Show me the complete page with all logic.

---COPY TO HERE---

---

## Prompt 3.2 - Add and Edit Inventory Item

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

CSS: Use globals.css classes for drawer, drawer__header, drawer__footer, form-group, form-label, form-input, input-prefix, btn variants.
Create /components/inventory/InventoryItemForm.module.css for form grid layout and drawer-specific sizing only.

Task: Build the Add/Edit Inventory Item as a slide-over drawer from the right side.
Create /components/inventory/InventoryItemForm.tsx

Used for both adding a new item and editing an existing one.

Form fields:
1. Item Name (required)
2. Category (text input with datalist of user's existing categories)
3. Unit (dropdown: KG, Grams, Litres, ML, Pieces)
4. Current Stock (number, shown only when ADDING, not editing)
5. Par Stock (number, minimum level before alert)
6. Cost Price (Rs. number, required)
7. MRP (Rs. number)
8. Availability Status (dropdown: Active, Out of Stock, Discontinued)
9. Notes (textarea, optional)

Validation: Name, Unit, Cost Price required. Stock values >= 0. Cost Price > 0.

On ADD submit:
1. Check free plan: if user has 50+ inventory items, show upgrade modal and block
2. INSERT into inventory_items with user_id = current user
3. INSERT into stock_movements: movement_type = 'purchase', quantity = current_stock entered, notes = 'Initial stock entry'
4. Show success toast "Item added successfully"
5. Close drawer and refresh list

On EDIT submit:
1. UPDATE inventory_items (do NOT update current_stock here)
2. Show success toast "Item updated"
3. Close drawer and refresh list

UI: Slide-over drawer from right. Rs. prefix on price fields. Save and Cancel buttons at bottom.

Show me the complete component.

---COPY TO HERE---

---

## Prompt 3.3 - Stock Arrival and Waste Modals

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

Task: Build two modal components for stock movements.

COMPONENT 1: /components/inventory/StockArrivalModal.tsx
Triggered when user clicks the Stock Arrival button on an inventory item.

Shows:
- Item name (read-only display at top)
- Current Stock (read-only display)
- Quantity Arriving (number input, required)
- New Cost Price (Rs., optional, updates cost_price if filled in)
- Notes (text, e.g. "Supplier delivery")

On submit (both steps must succeed, handle errors if first succeeds but second fails):
1. INSERT into stock_movements: movement_type = 'purchase', quantity = positive value, user_id, inventory_item_id, notes
2. UPDATE inventory_items: current_stock = current_stock + quantity arriving. If new cost price entered, also update cost_price
3. Show success toast: "Stock updated. New stock: X [unit]"
4. Close modal and refresh inventory list

COMPONENT 2: /components/inventory/WasteModal.tsx
Triggered when user clicks the waste button.

Shows:
- Item name (read-only)
- Current Stock (read-only)
- Quantity Lost (number input, required)
- Reason Type (dropdown: Spoilage or Damage, Internal Consumption, Other)
- Notes (optional)

Validation: Quantity Lost cannot exceed Current Stock.

On submit:
1. INSERT into stock_movements: movement_type = 'waste' or 'consumption' based on reason, quantity = NEGATIVE value
2. UPDATE inventory_items: current_stock = current_stock - quantity lost
3. Show success toast: "Stock deduction recorded"
4. Close modal and refresh

UI: Clean modals. Show impact preview: "After this entry, stock will be: X [unit]"

Show me both complete components.

---COPY TO HERE---

---

---

# PHASE 4 - CATALOGUE MODULE

---

## Prompt 4.1 - Catalogue List Page

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

Task: Build the Catalogue list page at /app/dashboard/catalogue/page.tsx

Requirements:
1. Fetch all catalogue_items where user_id = current user
2. Display as cards or table: Name, Category, Type (Simple or Bundle badge), Selling Price, Status, Actions
3. Bundle items show a colored "Bundle" badge
4. Simple items show "Simple" badge
5. Search bar by name (client-side)
6. Filter by category
7. Filter by availability_status
8. "Add Item" button opens catalogue item form
9. Empty state with friendly message

Freemium rule: If free plan AND count >= 30, show banner: "You've reached the free limit of 30 items. Upgrade to Pro."

Each item actions:
- Edit: opens edit form
- View Recipe (bundles only): popover showing ingredients list
- Toggle Active/Inactive: quick toggle without opening form

Show me the complete page.

---COPY TO HERE---

---

## Prompt 4.2 - Add Simple Catalogue Item

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

Task: Build the Add/Edit Catalogue Item form for SIMPLE items (not bundles yet).
Create /components/catalogue/CatalogueItemForm.tsx

A simple catalogue item maps to exactly ONE inventory item.

Form fields:
1. Item Name (required)
2. Category (text with datalist of user's existing categories)
3. Selling Price (Rs., required)
4. Item Type (radio buttons: "Simple Item" or "Bundle", bundle logic in next prompt)
5. Availability Status (Active or Inactive)
6. Notes (optional)

Simple Item mapping section (shown when Simple Item selected):
7. Linked Inventory Item (searchable dropdown of user's active inventory_items showing name + unit)
8. Quantity Used Per Sale (number, e.g. 100 for 100g per sale)
   Helper text: "When 1 unit of this item is sold, this much is deducted from inventory"

On ADD submit:
1. Check free plan limit (30 items)
2. INSERT into catalogue_items (is_bundle = false)
3. INSERT into catalogue_components (1 row: catalogue_item_id, inventory_item_id, quantity_used)
4. Success toast, close and refresh

On EDIT submit:
1. UPDATE catalogue_items
2. DELETE existing catalogue_components for this item, then INSERT updated one
3. Success toast

UI: Same slide-over drawer as inventory form. Show the inventory item's unit next to Quantity Used field.

Show me the complete component.

---COPY TO HERE---

---

## Prompt 4.3 - Bundle Recipe Builder

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

CSS: Use globals.css for all shared styles. Create /components/catalogue/BundleBuilder.module.css
for the recipe row grid, ingredient row structure, and preview panel layout only.

Task: Extend /components/catalogue/CatalogueItemForm.tsx to handle Bundle items.
This is the most important part of the catalogue module.

When the user selects "Bundle" as the item type, show the recipe builder section:

RECIPE BUILDER UI:
- A list of ingredient rows. Each row has:
  1. Inventory Item (searchable dropdown of user's active inventory_items)
  2. Quantity Used (number input)
  3. Unit (auto-filled from selected inventory item, read-only)
  4. Remove button (x)
- "Add Ingredient" button adds a new empty row
- Minimum 2 ingredients required for a bundle
- Cannot select the same inventory item twice in one bundle

Live preview panel alongside the builder:
- Bundle name
- Each ingredient with quantity and unit
- Estimated cost: SUM(quantity_used x cost_price) per component
- Selling price from the form above
- Estimated margin: selling_price minus estimated_cost as Rs. and percentage

On ADD Bundle submit:
1. Check free plan limit (30 items)
2. INSERT into catalogue_items (is_bundle = true)
3. INSERT into catalogue_components, one row per ingredient
4. Success toast: "Bundle created with X ingredients"

On EDIT Bundle submit:
1. UPDATE catalogue_items
2. DELETE all existing catalogue_components for this catalogue_item_id
3. INSERT fresh catalogue_components from current recipe state
4. Success toast

IMPORTANT NOTE IN CODE: The estimated cost preview uses current cost prices for reference only. The actual cost_price_at_sale at sale time is a snapshot taken from inventory at the moment of sale.

Show me the complete updated component with bundle logic fully integrated.

---COPY TO HERE---

---

---

# PHASE 5 - POS MODULE

---

## Prompt 5.1 - POS Screen Layout

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

CSS: Use globals.css classes: pos-card, pos-card.in-cart, pay-pill, pay-pill.active, btn btn--primary btn--full, card.
Create /app/dashboard/pos/pos.module.css for the two-panel layout, cart rows, and quantity controls only.

Task: Build the Quick-Tap POS screen at /app/dashboard/pos/page.tsx

This is the most used screen. It must be fast, clean, and mobile-friendly.

LAYOUT (two panels):
Left panel (60% on desktop, full width on mobile):
- Search bar to filter catalogue items
- Category filter buttons (pill/chip style)
- Grid of catalogue item cards (2-3 columns)
  Each card: Item Name, Selling Price, Category, Bundle badge if is_bundle = true
  Tapping a card adds it to cart
  If already in cart, tap again increases quantity by 1

Right panel (40% on desktop, below items on mobile):
- "Current Sale" header
- Cart items list. Each row:
  Item name | Qty (minus/plus controls) | Unit Price (Rs., editable inline) | Item Discount (Rs., editable) | Line Total | Remove (x)
- Below cart:
  Subtotal: Rs.
  Bill Discount: (Rs. input)
  Final Total: Rs. (large and bold)
- Payment Method: Cash, UPI, Card (pill buttons, one active at a time, UPI highlighted by default)
- Sale Note (optional text)
- "Confirm Sale" button (large, green, full width)
- "Clear Sale" button (small, below confirm)

Data: Fetch all active catalogue_items for this user on load.

Show me the complete page with layout and state management. No sale submission logic yet, that comes in the next prompt.

---COPY TO HERE---

---

## Prompt 5.2 - POS Sale Confirmation Logic (Hybrid RPC)

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

Task: Build the Confirm Sale flow using a Supabase RPC (stored procedure) for performance and reliability.
This is the most critical and most frequent operation in the app.
Do NOT use a plain Next.js API route for the core transaction — use Supabase RPC.

WHY RPC: A single POS sale touches 20+ database rows. At scale with many shops,
TypeScript API routes create too many network round trips. The RPC runs everything
inside the database in one call — faster, atomic, and more reliable.

PARTIAL SALE BEHAVIOUR (important):
- If stock is insufficient for an item, do NOT cancel the whole sale
- Still record the sale, still record the sale_item
- Set stock_deducted = false on that sale_item
- Skip the stock_movements insert and current_stock update for that item only
- Return a list of flagged items so the UI can warn the owner

--- STEP 1: Create the Supabase Migration for the RPC ---

Create /supabase/migrations/003_confirm_sale_rpc.sql

This SQL file creates a PostgreSQL function called confirm_sale with this signature:

CREATE OR REPLACE FUNCTION confirm_sale(
  p_user_id UUID,
  p_cart JSONB,
  p_bill_discount DECIMAL,
  p_payment_method TEXT,
  p_notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$

The function must:

1. Validate p_cart is not empty. Raise exception if empty.

2. Calculate line totals:
   For each item in p_cart:
   line_total = (unit_price x quantity) - item_discount_amount

3. Calculate bill totals:
   subtotal = SUM of all line_totals
   final_amount = subtotal - p_bill_discount

4. INSERT one row into sales table. Capture the new sale_id.

5. For each item in p_cart:
   a. Fetch the catalogue_components for this catalogue_item_id
   b. Check stock sufficiency for ALL components:
      - For each component: check if inventory_items.current_stock >= (component.quantity_used x cart_item.quantity)
      - If ALL components have enough stock: stock_ok = true
      - If ANY component is short: stock_ok = false
   c. Snapshot cost_price_at_sale:
      - Simple item: cost_price_at_sale = the linked inventory_item.cost_price
      - Bundle: cost_price_at_sale = SUM(component.quantity_used x inventory_item.cost_price)
   d. INSERT into sale_items with stock_deducted = stock_ok
   e. IF stock_ok = true:
      - For each component: INSERT into stock_movements (type: sale_deduction, qty: NEGATIVE)
      - For each component: UPDATE inventory_items SET current_stock = current_stock - (component.quantity_used x cart_item.quantity)
   f. IF stock_ok = false:
      - Add this item to a flagged_items list (catalogue_item name + shortfall details)
      - Do NOT insert stock_movements or update current_stock for this item

6. Return a JSONB result:
{
  "sale_id": "uuid",
  "success": true,
  "flagged_items": [
    { "name": "Cashews Pack", "reason": "Insufficient stock. Available: 50g, Required: 100g" }
  ]
}

--- STEP 2: Create a thin Next.js API route ---

Create /app/api/sales/confirm/route.ts

This route is just a thin wrapper that:
1. Validates the request body
2. Calls the Supabase RPC: supabase.rpc('confirm_sale', { p_user_id, p_cart, p_bill_discount, p_payment_method, p_notes })
3. Returns the RPC result to the frontend

The route does NOT contain any business logic — all logic lives in the RPC.

--- STEP 3: Create the sale service ---

Create /lib/services/sales.ts with:
- confirmSale(params): calls the API route, returns { sale_id, flagged_items }
- getSaleById(saleId): fetches a sale with its sale_items for the confirmation screen

--- STEP 4: Wire up the POS page ---

In the POS page:
- "Confirm Sale" button calls confirmSale() from the sales service
- Show loading spinner during submission
- On success: pass { sale_id, flagged_items } to the confirmation screen component
- On error: show error toast with the exact error message

Show me all files: the SQL migration, the API route, the sales service, and the updated POS page.

---COPY TO HERE---

---

## Prompt 5.3 - Sale Confirmation Screen

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

Task: Build the post-sale confirmation screen.

After a successful sale, replace the POS content with a confirmation view within the same page. Do not navigate away.

Confirmation screen shows:
1. Large green checkmark at top
2. "Sale Recorded!" heading
3. Sale summary card:
   - Each item: name, quantity, unit price, discount, line total
   - Subtotal
   - Bill discount if any
   - Final Amount (large and bold): Rs.X
   - Payment Method badge: Cash / UPI / Card
   - Date and time
4. Stock Shortfall Warning (shown ONLY if flagged_items list is not empty):
   - Amber/orange warning card below the sale summary
   - Heading: "Stock Update Needed"
   - List each flagged item: item name + reason (e.g. "Cashews Pack — Insufficient stock. Please update inventory.")
   - Message: "This sale was recorded. Please update inventory for the above items."
   - Link: "Go to Inventory" → /dashboard/inventory
5. Two buttons:
   - "New Sale" (primary, large): clears everything and returns to POS grid
   - "View in Sales History" (secondary): links to /dashboard/sales with a "Pro" indicator
6. Small note at bottom:
   - If no flagged items: "Stock updated for all items"
   - If flagged items: "Stock updated for X of Y items. X items need manual review."

The confirmation component receives props: { saleData, flaggedItems }
flaggedItems is an array from the RPC response — empty array means all stock was fine.

Note in code: No print or share button in v1. These are v2 features.

UI: Clean and positive. Green accent for success. Amber warning card if flagged items exist.
Final amount always visually prominent regardless of stock warnings.

Show me the complete confirmation component and how it integrates into the POS page.

---COPY TO HERE---

---

---

# PHASE 6 - DASHBOARD

---

## Prompt 6.1 - Dashboard Free Widgets

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs. (Indian Rupee, use Indian number formatting).

CSS: Use globals.css classes: metric-card + band + body + value modifiers, card, alert variants, badge variants, grid-3.
Create /app/dashboard/dashboard.module.css for widget section spacing and list layouts only.

Task: Build the main Dashboard page at /app/dashboard/page.tsx with the 3 free widgets visible to all users.

WIDGET 1 - Today's Summary (two cards side by side at top)

Card A: Today's Revenue
- Query: SUM(final_amount) from sales where user_id = current user AND sold_at >= today 00:00:00
- Display: Rs.X,XX,XXX large and bold
- Sub-label: "X transactions today"
- Color: blue accent

Card B: Today's Profit (simple items only)
- Query: SUM((unit_price minus cost_price_at_sale) x quantity minus item_discount_amount) from sale_items joined to sales where sold_at >= today AND is_bundle = false
- Display: Rs.X,XX,XXX
- Sub-label: "Simple items only. Bundles excluded in v1."
- Color: green if positive, red if negative

WIDGET 2 - Low Stock Alerts
- Query: inventory_items where user_id = current user AND current_stock <= par_stock AND availability_status = 'active'
- If 0 alerts: show green "All stock levels healthy"
- If alerts: show count badge "X items need restocking", list with item name, current stock, par stock, unit
- Each item links to inventory page

WIDGET 3 - Top 5 Selling Items (this month)
- Query: SUM(quantity) from sale_items joined to sales where sold_at >= first day of current month, grouped by catalogue_item_id, top 5
- Display as ranked list: item name, total quantity, total revenue
- Simple horizontal bar to show relative sales

Layout: Responsive grid, stack on mobile.
Empty state for new users: placeholder cards with prompts to visit POS.

Show me the complete dashboard page with all 3 widgets and their queries.

---COPY TO HERE---

---

## Prompt 6.2 - Pro Analytics (Locked for Free Users)

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

Task: Build the Pro analytics section of the Dashboard.
This section is VISIBLE to all users but LOCKED (blurred + upgrade prompt) for free plan users.

CSS: Use globals.css classes: card, text-label, badge variants, btn variants.
Create /components/dashboard/ProAnalytics.module.css for chart container sizing, blur overlay, and grid layout only.

Create /components/dashboard/ProAnalytics.tsx

Logic: Check subscription_plan from users table.
- If 'pro': render full analytics
- If 'free': render blurred and locked version with upgrade overlay

ANALYTICS TO BUILD (all with date range filter: Today, This Week, This Month, Custom):

1. Revenue Over Time: bar chart of daily revenue for selected period
   Query: sales grouped by date, SUM(final_amount)

2. Profit Over Time: line chart
   Query: sale_items joined to sales, profit per day

3. Profit by Category: horizontal bar chart
   Query: sale_items joined to catalogue_items.category, SUM profit per category

4. Payment Method Split: donut chart
   Query: sales grouped by payment_method, COUNT and SUM

5. Sales Transaction History: paginated table
   Columns: Date/Time, Items, Subtotal, Discount, Final Amount, Payment Method
   Each row expandable to show line items

6. Top Selling Time: bar chart by hour of day
   Query: extract hour from sales.sold_at, COUNT per hour

Use recharts for all charts. Install if needed: npm install recharts

LOCKED STATE for free users:
- Render all 6 analytics components
- Wrap entire section in a blur overlay: CSS filter blur(4px), pointer-events none
- Centered overlay card on top:
  Title: "Unlock Full Analytics"
  Description: "Get deep insights into your revenue, profit, and sales patterns."
  Button: "Upgrade to Pro" links to /dashboard/settings/billing
- The overlay covers all 6 widgets as a group, not individually

Show me the complete component with both locked and unlocked states.

---COPY TO HERE---

---

---

# PHASE 7 - RAZORPAY BILLING

---

## Prompt 7.1 - Billing Page and Razorpay Checkout

---COPY FROM HERE---

You are helping me build SmartInventory AI. Currency is Rs.

CSS: Use globals.css classes: card, badge variants, btn variants, plan-bar + modifiers, upgrade-banner.
Create /app/dashboard/settings/billing/billing.module.css for the plan comparison grid layout only.

Task: Set up Razorpay billing and the billing settings page.
Payment gateway: Razorpay (NOT Stripe). Install razorpay npm package if not already installed.

Create /lib/razorpay-config.ts:
- Pro plan pricing constants: MONTHLY_PRICE_INR = 49900 (in paise, = Rs.499), YEARLY_PRICE_INR = 499900 (= Rs.4999)
- Plan features list for the pricing UI
- Helper function getPlanFeatures(plan: 'free' | 'pro')

Create /app/dashboard/settings/billing/page.tsx:

FOR FREE USERS show:
1. Current plan card: "Free Plan" with included features and limits
2. Upgrade card: "Pro Plan" with:
   - Monthly pricing: Rs.499/month
   - Yearly pricing: Rs.4,999/year with "Save 20%" badge
   - Feature comparison:
     Unlimited inventory items (Free: max 50)
     Unlimited catalogue items (Free: max 30)
     Full analytics dashboard (Free: basic only)
     Sales history and reports
     Priority support
   - "Upgrade to Pro — Monthly" button
   - "Upgrade to Pro — Yearly (Save 20%)" button

FOR PRO USERS show:
1. Current plan card: "Pro Plan Active" with renewal date
2. "Cancel Subscription" button with confirmation modal
3. Note: Razorpay does not have a customer portal — show a support email instead

Create API routes:
- /app/api/razorpay/create-order/route.ts
  POST: creates a Razorpay order using the Razorpay Node SDK
  Body: { plan: 'monthly' | 'yearly', user_id: string }
  Creates order with correct amount in paise
  Returns: { order_id, amount, currency, key_id }

- /app/api/razorpay/verify-payment/route.ts
  POST: verifies Razorpay payment signature after successful payment
  Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id }
  Verifies signature using crypto.createHmac
  On success: UPDATE users SET subscription_plan = 'pro'
  Returns: { success: true }

In the billing page, wire the upgrade buttons to:
1. Call create-order API to get order_id
2. Open Razorpay checkout using window.Razorpay with the order details
3. On payment success: call verify-payment API
4. On verify success: show success message and refresh the page

Load Razorpay checkout script in layout: <script src="https://checkout.razorpay.com/v1/checkout.js">

Show me all files with complete code.

---COPY TO HERE---

---

## Prompt 7.2 - Razorpay Webhook

---COPY FROM HERE---

You are helping me build SmartInventory AI.

Task: Build the Razorpay webhook handler to keep the database in sync with subscription status.

Create /app/api/razorpay/webhook/route.ts

Requirements:
1. Verify Razorpay webhook signature:
   - Get the raw request body as text
   - Get the X-Razorpay-Signature header
   - Compute HMAC SHA256 of the raw body using RAZORPAY_WEBHOOK_SECRET
   - Compare computed signature with the header value
   - If mismatch: return 400

2. Handle these Razorpay webhook events:

payment.captured:
- Extract user_id from payment.notes (we pass it when creating the order)
- UPDATE users SET subscription_plan = 'pro' WHERE id = user_id
- Store razorpay_customer_id (payment.contact or payment.email) on user record
- Return 200

subscription.cancelled:
- Find user by razorpay_customer_id
- UPDATE users SET subscription_plan = 'free'
- Return 200

payment.failed:
- Log the failure with user_id from notes
- Do NOT change subscription_plan
- Return 200

3. Return 200 for all handled events, 400 for signature failures

Also create /supabase/migrations/002_add_razorpay_customer.sql:
- ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;

Update /types/database.ts to add razorpay_customer_id to the users interface.

IMPORTANT: The webhook route must use the raw request body as text for signature verification.
Do NOT use request.json() before verifying — use request.text() instead.

Show me the complete webhook handler and migration file.

---COPY TO HERE---

---

## Prompt 7.3 - Free Plan Limit Enforcement

---COPY FROM HERE---

You are helping me build SmartInventory AI.

Task: Add server-side free plan limit enforcement as a reusable utility.

Create /lib/plan-limits.ts:

Constants:
FREE_INVENTORY_LIMIT = 50
FREE_CATALOGUE_LIMIT = 30

Function: checkInventoryLimit(userId: string): Promise<{ allowed: boolean, current: number, limit: number }>
- COUNT inventory_items where user_id = userId
- Fetch subscription_plan from users table
- If pro: always return allowed true
- If free AND count >= 50: return allowed false with current count and limit

Function: checkCatalogueLimit(userId: string): Promise<{ allowed: boolean, current: number, limit: number }>
- Same logic for catalogue_items, limit 30

Create /components/ui/UpgradeModal.tsx:
- Props: isOpen, onClose, limitType ('inventory' | 'catalogue')
- Shows: friendly message explaining the limit reached, feature comparison, "Upgrade to Pro" button linking to /dashboard/settings/billing
- "Maybe Later" button to dismiss

Update the inventory item creation API to call checkInventoryLimit before inserting.
If not allowed, return 403 with limit info.

Update the catalogue item creation API to call checkCatalogueLimit before inserting.
If not allowed, return 403 with limit info.

Update the frontend forms to show UpgradeModal when they receive a 403 response instead of showing a generic error.

Note: UpgradeModal "Upgrade to Pro" button links to /dashboard/settings/billing where the Razorpay checkout flow lives.

Show me all files and all updates to existing code.

---COPY TO HERE---

---

---

# BUG FIX PROMPTS
Use these when something breaks. Copy the relevant one and fill in the details.

---

## When you see an error message:

---COPY FROM HERE---

I am getting this error in SmartInventory AI. Here is the exact error:

[PASTE THE FULL ERROR MESSAGE FROM TERMINAL OR BROWSER CONSOLE]

This error happens when I try to: [DESCRIBE WHAT YOU WERE DOING]

The file where the error seems to come from: [FILE PATH IF VISIBLE]

Do not rewrite the entire file. Identify the exact cause and fix only what is broken.

---COPY TO HERE---

---

## When a page shows blank or nothing loads:

---COPY FROM HERE---

The page at [PAGE URL] is showing blank in SmartInventory AI. No visible errors. Just empty or white.

Please check:
1. Is there a missing data fetch or failed Supabase query?
2. Is there a missing loading or error state causing a blank render?
3. Is there an auth or session issue blocking the data?

Show me what is wrong and fix only that specific issue. Do not rewrite the whole page.

---COPY TO HERE---

---

## When Supabase data is not saving:

---COPY FROM HERE---

Data is not being saved to Supabase in SmartInventory AI.

I am trying to: [DESCRIBE THE ACTION, e.g. add a new inventory item]
The form submits without error but nothing appears in the database.

Please check:
1. Is user_id being passed correctly?
2. Is RLS (Row Level Security) blocking the insert?
3. Is the Supabase client using the correct session?

Show me the exact fix.

---COPY TO HERE---

---

## When something works locally but breaks on Vercel:

---COPY FROM HERE---

A feature works on localhost but breaks after deploying to Vercel in SmartInventory AI.

The feature: [DESCRIBE IT]
The error on Vercel: [PASTE ERROR FROM VERCEL LOGS]

Please check:
1. Missing environment variables on Vercel
2. Server vs client component mismatch
3. Edge runtime compatibility issues

Show me what is wrong and how to fix it.

---COPY TO HERE---

---

## When Claude invents new tables or changes the schema:

---COPY FROM HERE---

Stop. You have deviated from the defined schema for SmartInventory AI.

The database has EXACTLY 7 tables and you must not create, rename, or modify any table without my explicit instruction.

The 7 tables are: users, inventory_items, catalogue_items, catalogue_components, sales, sale_items, stock_movements

Redo the last task using only these 7 tables.

---COPY TO HERE---

---

*Last updated: SmartInventory AI - PROMPTS.md v1 Final - synced with PRD.md + SCHEMA.md + STYLEGUIDE.md v1 — Razorpay (not Stripe)*
