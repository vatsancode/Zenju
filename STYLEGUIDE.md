# STYLEGUIDE.md — SmartInventory AI (v1)
> CSS reference for Claude. Read this before writing any UI code.
> Paste alongside PRD.md and SCHEMA.md at the start of every session.
> Last synced with: PRD.md v1 Final + SCHEMA.md v1 Final

---

## The Golden Rule

**There is no Tailwind in this project. There never was.**
Do not write `className="flex items-center gap-4 text-sm font-medium"`.
Do not install or import Tailwind in any form.
Every style comes from one of two places only:
1. `globals.css` — shared classes used everywhere
2. `ComponentName.module.css` — styles specific to one component

---

## CSS Architecture

```
/styles
  globals.css          ← design tokens + all shared component classes
                         import once in /app/layout.tsx

/components
  /ui
    Button.module.css
    Card.module.css
    Badge.module.css
    ...
  /layout
    Sidebar.module.css
    TopBar.module.css
  /inventory
    InventoryForm.module.css
    InventoryList.module.css
  /catalogue
    CatalogueForm.module.css
    BundleBuilder.module.css
  /pos
    POSScreen.module.css
    Cart.module.css
  /dashboard
    MetricCards.module.css
    ProAnalytics.module.css
```

**Rule:** If a style is used in more than one component → it belongs in `globals.css`.
If a style is only ever used in one component → it belongs in that component's `.module.css`.

---

## How to Use globals.css Classes in JSX

Import nothing — globals.css is imported once in layout.tsx and available everywhere.

```tsx
// Correct — use className with globals.css class names directly
<div className="card">
  <div className="card__header">
    <h3 className="card__title">Inventory Items</h3>
  </div>
</div>

<button className="btn btn--primary btn--lg btn--full">
  Confirm Sale
</button>

<span className="badge badge--success">In Stock</span>

<div className="alert alert--warning">
  <div className="alert__dot"></div>
  <div>
    <p className="alert__title">Stock update needed</p>
    <p className="alert__body">Please update inventory for flagged items.</p>
  </div>
</div>
```

---

## How to Use CSS Modules in JSX

```tsx
// At top of component file
import styles from './InventoryForm.module.css'

// In JSX — combine module class with global class using template literal
<div className={styles.formPanel}>
  <input className={`form-input ${styles.itemNameInput}`} />
</div>

// Module class only
<div className={styles.recipeRow}>

// Multiple module classes
<div className={`${styles.card} ${styles.highlighted}`}>
```

---

## CSS Token Reference

These are the CSS variables defined in globals.css.
**Always use variables. Never hardcode hex colors for text or backgrounds.**

### Brand Colors (use for decorative/accent only)
```css
var(--color-brand-navy)    /* #1E3A5F — sidebar, headings */
var(--color-brand-blue)    /* #2E86AB — primary buttons, links, bands */
var(--color-brand-green)   /* #1A7A4A — success band, profit */
var(--color-brand-amber)   /* #D35400 — warning band, low stock */
var(--color-brand-red)     /* #C0392B — danger band, errors */
```

### Backgrounds (use for all surface colors)
```css
var(--color-bg-page)       /* page background — outermost layer */
var(--color-bg-primary)    /* white card surface */
var(--color-bg-secondary)  /* subtle surface — table hover, input bg */
var(--color-bg-tertiary)   /* stronger surface — dividers, disabled */
var(--color-bg-info)       /* blue-tinted — info alerts, focus rings */
var(--color-bg-success)    /* green-tinted — success alerts */
var(--color-bg-warning)    /* amber-tinted — warning alerts, low stock rows */
var(--color-bg-danger)     /* red-tinted — error alerts */
```

### Text Colors (use for ALL text)
```css
var(--color-text-primary)    /* main body text */
var(--color-text-secondary)  /* labels, descriptions */
var(--color-text-tertiary)   /* hints, placeholders, meta */
var(--color-text-disabled)   /* disabled state text */
var(--color-text-info)       /* blue text on info background */
var(--color-text-success)    /* green text on success background */
var(--color-text-warning)    /* amber text on warning background */
var(--color-text-danger)     /* red text on danger background */
```

### Borders
```css
var(--color-border-light)    /* 0.06 alpha — subtle dividers */
var(--color-border-default)  /* 0.12 alpha — card borders, input borders */
var(--color-border-strong)   /* 0.20 alpha — hover borders */
var(--color-border-info)     /* info-tinted border */
var(--color-border-success)  /* success-tinted border */
var(--color-border-warning)  /* warning-tinted border */
var(--color-border-danger)   /* danger-tinted border */
```

### Spacing (always use these, never magic numbers)
```css
var(--space-1)    /* 4px */
var(--space-2)    /* 8px */
var(--space-3)    /* 12px */
var(--space-4)    /* 16px */
var(--space-5)    /* 20px */
var(--space-6)    /* 24px */
var(--space-8)    /* 32px */
var(--space-10)   /* 40px */
var(--space-12)   /* 48px */
var(--space-16)   /* 64px */
```

### Border Radius
```css
var(--radius-sm)    /* 4px  — chips, code tags */
var(--radius-md)    /* 8px  — inputs, small elements */
var(--radius-btn)   /* 10px — buttons */
var(--radius-card)  /* 12px — metric cards, POS cards */
var(--radius-lg)    /* 14px — content cards, panels */
var(--radius-xl)    /* 16px — modals, drawers */
var(--radius-pill)  /* 999px — badges, pills */
```

### Typography Scale
```css
var(--text-xs)    /* 11px — labels, hints, badges */
var(--text-sm)    /* 12px — secondary text, timestamps */
var(--text-base)  /* 14px — body text, form inputs */
var(--text-md)    /* 15px — card titles, sub-headings */
var(--text-lg)    /* 18px — section headings */
var(--text-xl)    /* 22px — page sub-titles */
var(--text-2xl)   /* 28px — page titles */
var(--text-3xl)   /* 34px — hero numbers */
```

### Transitions
```css
var(--transition-fast)  /* 0.15s ease — input focus, border color */
var(--transition-base)  /* 0.20s ease — buttons, cards, nav items */
var(--transition-slow)  /* 0.30s ease — drawers, modals */
```

### Layout
```css
var(--sidebar-width)    /* 220px */
var(--topbar-height)    /* 56px */
```

---

## Pre-Built Component Classes in globals.css

These classes are ready to use. Do NOT re-define them in module files.

### Metric Cards (Top Band Style)
```html
<div class="metric-card">
  <div class="metric-card__band metric-card__band--blue"></div>
  <div class="metric-card__body">
    <p class="metric-card__label">Today's Revenue</p>
    <p class="metric-card__value metric-card__value--blue">₹24,500</p>
    <p class="metric-card__sub">12 transactions</p>
  </div>
</div>
```
Band modifiers: `--blue` `--green` `--amber` `--red` `--navy`
Value modifiers: `--blue` `--green` `--amber` `--red`

### Content Cards
```html
<div class="card">                   <!-- standard card -->
<div class="card card--sm">          <!-- compact card -->
<div class="card card--lg">          <!-- spacious card -->
<div class="empty-state">            <!-- dashed border empty state -->
```

### Badges
```html
<span class="badge badge--info">Active</span>
<span class="badge badge--success">In Stock</span>
<span class="badge badge--warning">Low Stock</span>
<span class="badge badge--danger">Out of Stock</span>
<span class="badge badge--neutral">Inactive</span>
<span class="badge badge--brand">UPI</span>
<span class="badge badge--navy">Pro</span>
```

### Buttons
```html
<button class="btn btn--primary">Primary</button>
<button class="btn btn--navy">Secondary</button>
<button class="btn btn--outline">Outline</button>
<button class="btn btn--ghost">Ghost</button>
<button class="btn btn--success">Success</button>
<button class="btn btn--danger">Danger</button>

<!-- Size modifiers — add alongside variant -->
<button class="btn btn--primary btn--sm">Small</button>
<button class="btn btn--primary btn--lg">Large</button>
<button class="btn btn--primary btn--full">Full Width</button>
```

### Form Elements
```html
<!-- Standard input -->
<div class="form-group">
  <label class="form-label form-label--required">Item Name</label>
  <input class="form-input" type="text" placeholder="e.g. Cashews" />
  <p class="form-hint">Enter the raw ingredient name</p>
</div>

<!-- Error state -->
<input class="form-input form-input--error" />
<p class="form-error">This field is required</p>

<!-- ₹ Prefix input -->
<div class="input-prefix">
  <span class="input-prefix__label">₹</span>
  <input class="input-prefix__input" type="number" placeholder="0.00" />
</div>

<!-- Select -->
<select class="form-select">
  <option>KG</option>
</select>

<!-- Textarea -->
<textarea class="form-textarea" placeholder="Notes..."></textarea>
```

### Alert Cards
```html
<div class="alert alert--info">
  <div class="alert__dot"></div>
  <div>
    <p class="alert__title">Title here</p>
    <p class="alert__body">Description here</p>
  </div>
</div>
```
Modifiers: `alert--info` `alert--success` `alert--warning` `alert--danger`

### Toast Notifications
```html
<div class="toast">
  <div class="toast__bar toast__bar--success"></div>
  <div>
    <p class="toast__text">Item added successfully</p>
    <p class="toast__sub">Cashews added to inventory</p>
  </div>
</div>
```
Bar modifiers: `toast__bar--info` `toast__bar--success` `toast__bar--warning` `toast__bar--danger`

### Data Table
```html
<table class="data-table">
  <thead>
    <tr><th>Name</th><th>Stock</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Cashews</td><td>120 KG</td><td><span class="badge badge--success">Active</span></td></tr>
    <tr class="row--low-stock"><td>Almonds</td><td>18 KG</td><td><span class="badge badge--warning">Low</span></td></tr>
    <tr class="row--discontinued"><td>Walnuts</td><td>0 KG</td><td><span class="badge badge--neutral">Discontinued</span></td></tr>
  </tbody>
</table>
```

### POS Components
```html
<!-- Catalogue card -->
<div class="pos-card">
  <p class="pos-card__name">Cashew 100g</p>
  <p class="pos-card__category">Loose Items</p>
  <p class="pos-card__price">₹180</p>
</div>

<!-- Active state (item in cart) -->
<div class="pos-card in-cart">...</div>

<!-- Payment pills -->
<button class="pay-pill">Cash</button>
<button class="pay-pill active">UPI</button>
<button class="pay-pill">Card</button>
```

### Sidebar Navigation
```html
<nav class="sidebar">
  <div class="sidebar__logo">Smart<span>Inventory</span> AI</div>
  <p class="sidebar__section">Main</p>
  <a class="nav-item active" href="/dashboard">
    <div class="nav-item__bar"></div>
    Dashboard
  </a>
  <a class="nav-item" href="/inventory">
    <div class="nav-item__bar"></div>
    Inventory
  </a>
  <a class="nav-item" href="/sales">
    <div class="nav-item__bar"></div>
    Sales History
    <span class="nav-item__pro-badge">Pro</span>
  </a>
  <div class="sidebar__user">
    <div class="sidebar__avatar">RK</div>
    <div>
      <p class="sidebar__name">Ramesh Kumar</p>
      <p class="sidebar__plan">Free plan</p>
    </div>
  </div>
</nav>
```

### Drawer & Modal
```html
<!-- Drawer (slide from right) -->
<div class="overlay">
  <div class="drawer">
    <div class="drawer__header">
      <h3 class="drawer__title">Add Inventory Item</h3>
      <button class="drawer__close">×</button>
    </div>
    <!-- form content -->
    <div class="drawer__footer">
      <button class="btn btn--ghost btn--full">Cancel</button>
      <button class="btn btn--primary btn--full">Save Item</button>
    </div>
  </div>
</div>

<!-- Modal -->
<div class="modal-overlay">
  <div class="modal">
    <h3 class="modal__title">Confirm Action</h3>
    <p class="modal__body">Are you sure you want to do this?</p>
    <div class="modal__actions">
      <button class="btn btn--ghost btn--sm">Cancel</button>
      <button class="btn btn--danger btn--sm">Confirm</button>
    </div>
  </div>
</div>
```

### Layout Shell
```html
<div class="dashboard-layout">
  <Sidebar />                      <!-- position: fixed, 220px wide -->
  <div class="main-content">
    <TopBar />                     <!-- position: sticky, 56px tall -->
    <div class="page-body">
      <div class="page-header">
        <h1>Inventory</h1>
        <p>Manage your raw stock items</p>
      </div>
      <!-- page content here -->
    </div>
  </div>
</div>
```

### Grid Helpers
```html
<div class="grid-2">  <!-- 2 columns -->
<div class="grid-3">  <!-- 3 columns — use for metric cards -->
<div class="grid-4">  <!-- 4 columns — responsive, collapses on tablet -->
```

### Freemium Components
```html
<!-- Plan usage bar -->
<div class="plan-bar">
  <div class="plan-bar__fill" style="width: 76%"></div>
</div>
<!-- Near limit (>80%) -->
<div class="plan-bar__fill plan-bar__fill--near" style="width: 88%">
<!-- At limit (100%) -->
<div class="plan-bar__fill plan-bar__fill--full" style="width: 100%">

<!-- Upgrade banner -->
<div class="upgrade-banner">
  <p class="upgrade-banner__text">You've reached the free limit of 50 items.</p>
  <button class="btn btn--primary btn--sm">Upgrade to Pro</button>
</div>
```

---

## Dark Mode Toggle

Dark mode is handled by adding/removing `data-theme="dark"` on the `<html>` element.
All CSS variables flip automatically. No extra classes needed on any component.

```tsx
// ThemeContext.tsx or wherever you manage theme
const toggleTheme = () => {
  const html = document.documentElement
  const isDark = html.getAttribute('data-theme') === 'dark'
  isDark
    ? html.removeAttribute('data-theme')
    : html.setAttribute('data-theme', 'dark')
  localStorage.setItem('theme', isDark ? 'light' : 'dark')
}

// On app load — restore saved preference
const saved = localStorage.getItem('theme')
if (saved === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
}
```

---

## CSS Module Rules

When writing a `.module.css` file:

1. **Use CSS variables from globals.css** — never hardcode colors or sizes
2. **Never re-define a globals.css class** — if `.btn--primary` already exists, do not write it again
3. **Only write what is unique to this component** — layout, positioning, component-specific sizes
4. **Namespace classes clearly** — `.formPanel`, `.recipeRow`, `.cartItem` not `.panel`, `.row`, `.item`

Example — `InventoryForm.module.css`:
```css
.formPanel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.unitRow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.stockPreview {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-2);
}
```

---

## What Claude Must NEVER Do

- Write `className="flex items-center gap-2 text-sm"` — no Tailwind
- Write `style={{ color: '#1A5276' }}` — no hardcoded hex for text/bg
- Write `style={{ background: '#EBF5FB' }}` — no hardcoded hex for text/bg
- Import or install `tailwindcss`, `@tailwindcss/forms`, or any Tailwind plugin
- Use `tw-` prefixed classes
- Create a `tailwind.config.js`
- Use inline styles for layout (use CSS module classes instead)
- Re-define globals.css classes in module files

**Inline styles are ONLY allowed for dynamic values that change at runtime:**
```tsx
/* Allowed — value is dynamic */
<div className="plan-bar__fill" style={{ width: `${percentage}%` }} />
<div className="metric-card__band" style={{ background: dynamicColor }} />

/* Not allowed — value is static, should be in CSS */
<div style={{ padding: '16px', borderRadius: '12px' }} />
```

---

## Typography Cheat Sheet

```tsx
<h1>Page title</h1>                                    /* 28px / 600 */
<h2>Section heading</h2>                               /* 22px / 600 */
<h3>Card title</h3>                                    /* 18px / 500 */
<h4>Sub-label</h4>                                     /* 15px / 500 */
<p>Body text</p>                                       /* 14px / 400 */
<p className="text-secondary">Muted text</p>
<p className="text-tertiary">Hint text</p>
<span className="text-label">SECTION LABEL</span>      /* 11px uppercase */
<span className="text-mono">code value</span>          /* monospace */
<span className="text-success">₹8,200</span>           /* green */
<span className="text-warning">Low stock</span>        /* amber */
<span className="text-danger">Error message</span>     /* red */
<span className="text-brand">Link or accent</span>     /* blue */
```

---

## Currency Formatting (India)

Always format Indian Rupee values using this pattern:
```tsx
const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
// formatINR(24500) → "₹24,500"
// formatINR(150000) → "₹1,50,000"
```

---

*Last updated: SmartInventory AI — STYLEGUIDE.md v1 Final*
*Covers: globals.css v1, CSS Modules pattern, dark mode toggle*
