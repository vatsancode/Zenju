import type { InventoryItemWithDetails } from '@/lib/services/inventory'
import type { VariantWithDetails } from '@/lib/services/variants'

const PREFIX = 'zenju:just-created-product:'

export interface CreatedProductHandoff {
  item: InventoryItemWithDetails
  variant: VariantWithDetails
}

// Hands the just-created item/variant off to whichever page we're about to
// navigate to, so it can render instantly instead of re-fetching data the
// create request already returned. Read-once — consumeCreatedProduct clears
// the entry, so a later visit to the same URL (browser back/forward, a
// bookmark) falls through to a real fetch instead of showing stale data.
export function stashCreatedProduct(itemId: string, data: CreatedProductHandoff) {
  try {
    sessionStorage.setItem(PREFIX + itemId, JSON.stringify(data))
  } catch {
    // sessionStorage can be blocked in some browser configurations (see
    // storage-access.ts) — the hand-off is an optimization, not a
    // requirement, so failing silently just means the target page fetches.
  }
}

export function consumeCreatedProduct(itemId: string): CreatedProductHandoff | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + itemId)
    if (!raw) return null
    sessionStorage.removeItem(PREFIX + itemId)
    return JSON.parse(raw) as CreatedProductHandoff
  } catch {
    return null
  }
}
