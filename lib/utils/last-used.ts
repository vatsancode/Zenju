// Remembers the last unit/category/subcategory picked in the Add Product
// form, so the next product starts pre-filled instead of blank — most
// businesses sell in one or two units and repeat categories often. This is
// a personal, per-browser convenience (not shared data), so localStorage is
// enough; it's never treated as a source of truth, only a starting point
// the user can see and change.
const PREFIX = 'zenju:last-product-'

export interface LastUsedProductFields {
  unit: string
  category: string
  subcategory: string
}

export function saveLastUsedProductFields(fields: LastUsedProductFields) {
  try {
    if (fields.unit) localStorage.setItem(PREFIX + 'unit', fields.unit)
    if (fields.category) localStorage.setItem(PREFIX + 'category', fields.category)
    else localStorage.removeItem(PREFIX + 'category')
    if (fields.subcategory) localStorage.setItem(PREFIX + 'subcategory', fields.subcategory)
    else localStorage.removeItem(PREFIX + 'subcategory')
  } catch {
    // localStorage can be blocked in some browser configurations (see
    // storage-access.ts) — remembering the last value is a nicety, not a
    // requirement, so failing silently just means the form starts blank.
  }
}

export function loadLastUsedProductFields(): Partial<LastUsedProductFields> {
  try {
    return {
      unit: localStorage.getItem(PREFIX + 'unit') ?? undefined,
      category: localStorage.getItem(PREFIX + 'category') ?? undefined,
      subcategory: localStorage.getItem(PREFIX + 'subcategory') ?? undefined,
    }
  } catch {
    return {}
  }
}
