'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search, Plus, Minus, X, ShoppingCart, Tag, AlertTriangle,
  Check, Package, Trash2, Banknote, Smartphone, Percent,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  mockCatalogueItems, mockInventoryItems, mockCategories,
  mockOffers, formatINR, mockUser,
} from '@/lib/mock-data'
import type { MockOffer } from '@/lib/mock-data'
import styles from './pos.module.css'

// ─── Types ──────────────────────────────────────────────────────────────────────

type CartItem = {
  id: string
  catalogueItemId: string
  name: string
  variantId: string | null
  variantLabel: string | null
  stockKey: string | null
  quantity: number
  unitPrice: number
}

type AppliedOffer = {
  offerId: string
  offerName: string
  cartItemIds: string[]
  discountAmount: number
}

type VariantInfo = {
  id: string
  label: string
  stockKey: string
}

type OfferEvaluation = {
  offerId: string
  offerName: string
  status: 'eligible' | 'partial'
  eligibleQty: number
  neededQty: number
  potentialSavings: number
  benefitType: string
}

type ToastState = {
  message: string
  type: 'success' | 'warning' | 'danger' | 'info'
}

type StockWarningModal = {
  itemName: string
  variantLabel: string | null
  stockKey: string
  pendingItem: typeof mockCatalogueItems[0]
  pendingVariantId: string | null
  pendingVariantLabel: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getAvailableVariants(
  catalogueItem: typeof mockCatalogueItems[0]
): VariantInfo[] {
  const mapped = (catalogueItem as any).mapped_inventory as
    | { inventory_item_id: string; selected_variants?: string[] }[]
    | undefined
  if (!mapped?.length) return []

  const variants: VariantInfo[] = []
  for (const mapping of mapped) {
    const invItem = mockInventoryItems.find(i => i.id === mapping.inventory_item_id)
    if (!invItem?.variants) continue
    const selectedIds = mapping.selected_variants || []
    for (const v of invItem.variants) {
      if (selectedIds.includes(v.id)) {
        variants.push({
          id: v.id,
          label: v.attributes.join(' · '),
          stockKey: v.id,
        })
      }
    }
  }
  return variants
}

function evaluateOffers(
  cart: CartItem[],
  offers: MockOffer[],
  appliedOfferIds: string[],
  lockedCartItemIds: Set<string>,
): OfferEvaluation[] {
  return offers
    .filter(o => o.active && !appliedOfferIds.includes(o.id))
    .map(offer => {
      const eligibleItems = cart.filter(
        ci =>
          offer.applicable_item_ids.includes(ci.catalogueItemId) &&
          !lockedCartItemIds.has(ci.id),
      )
      const eligibleQty = eligibleItems.reduce((sum, ci) => sum + ci.quantity, 0)
      const needed = Math.max(0, offer.min_quantity - eligibleQty)

      let savings = 0
      if (eligibleQty >= offer.min_quantity) {
        const prices = eligibleItems
          .flatMap(ci => Array(ci.quantity).fill(ci.unitPrice))
          .sort((a: number, b: number) => b - a)
        const comboItems = prices.slice(0, offer.min_quantity)
        const comboSum = comboItems.reduce((s: number, p: number) => s + p, 0)

        switch (offer.benefit_type) {
          case 'fixed_price':
            savings = Math.max(0, comboSum - offer.benefit_value)
            break
          case 'percentage_discount':
            savings = Math.round((comboSum * offer.benefit_value) / 100)
            break
          case 'flat_discount':
            savings = Math.min(comboSum, offer.benefit_value)
            break
          case 'free_item':
            savings = comboItems[comboItems.length - 1] || 0
            break
        }
      }

      return {
        offerId: offer.id,
        offerName: offer.name,
        status: eligibleQty >= offer.min_quantity ? ('eligible' as const) : ('partial' as const),
        eligibleQty,
        neededQty: needed,
        potentialSavings: savings,
        benefitType: offer.benefit_type,
      }
    })
    .filter(e => e.eligibleQty > 0)
}

function calculateOfferDiscount(
  selectedItems: CartItem[],
  offer: MockOffer,
): number {
  const prices = selectedItems
    .flatMap(ci => Array(ci.quantity).fill(ci.unitPrice))
    .sort((a: number, b: number) => b - a)
  const comboItems = prices.slice(0, offer.min_quantity)
  const comboSum = comboItems.reduce((s: number, p: number) => s + p, 0)

  switch (offer.benefit_type) {
    case 'fixed_price':
      return Math.max(0, comboSum - offer.benefit_value)
    case 'percentage_discount':
      return Math.round((comboSum * offer.benefit_value) / 100)
    case 'flat_discount':
      return Math.min(comboSum, offer.benefit_value)
    case 'free_item':
      return comboItems[comboItems.length - 1] || 0
    default:
      return 0
  }
}

function benefitDescription(offer: MockOffer): string {
  switch (offer.benefit_type) {
    case 'fixed_price':
      return `Combo at ${formatINR(offer.benefit_value)}`
    case 'percentage_discount':
      return `${offer.benefit_value}% off`
    case 'flat_discount':
      return `${formatINR(offer.benefit_value)} off`
    case 'free_item':
      return 'Cheapest item free'
    default:
      return ''
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────────

export default function POSPage() {
  // ── State ─────────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [appliedOffers, setAppliedOffers] = useState<AppliedOffer[]>([])
  const [variantPickerItemId, setVariantPickerItemId] = useState<string | null>(null)

  const [stockLevels, setStockLevels] = useState<Record<string, number>>(() => {
    const levels: Record<string, number> = {}
    mockInventoryItems.forEach(item => {
      if (item.variants) {
        item.variants.forEach(v => {
          levels[v.id] = v.quantity
        })
      }
      levels[item.id] = item.current_stock
    })
    return levels
  })

  const [seenStockWarnings, setSeenStockWarnings] = useState<Set<string>>(new Set())
  const [stockWarningModal, setStockWarningModal] = useState<StockWarningModal | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash')
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [billDiscountType, setBillDiscountType] = useState<'flat' | 'percent'>('percent')
  const [billDiscountValue, setBillDiscountValue] = useState<string>('')

  // ── Toast helper ──────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Focus search on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // ── Validate applied offers when cart changes ─────────────────────────────────
  useEffect(() => {
    setAppliedOffers(prev => {
      const valid = prev.filter(ao => {
        const offer = mockOffers.find(o => o.id === ao.offerId)
        if (!offer) return false
        const allExist = ao.cartItemIds.every(cid => cart.some(ci => ci.id === cid))
        if (!allExist) return false
        const totalQty = cart
          .filter(ci => ao.cartItemIds.includes(ci.id))
          .reduce((sum, ci) => sum + ci.quantity, 0)
        return totalQty >= offer.min_quantity
      })
      if (valid.length < prev.length && prev.length > 0) {
        showToast('Combo removed', 'warning')
      }
      return valid
    })
  }, [cart, showToast])

  // ── Derived: active catalogue items ───────────────────────────────────────────
  const activeItems = useMemo(
    () => mockCatalogueItems.filter(i => i.availability_status === 'active'),
    [],
  )

  const categories = useMemo(() => {
    const cats = Array.from(new Set(activeItems.map(i => i.category_name)))
    return cats.sort()
  }, [activeItems])

  const filteredItems = useMemo(() => {
    return activeItems.filter(item => {
      const matchesSearch =
        !search || item.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = !activeCategory || item.category_name === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [activeItems, search, activeCategory])

  // ── Derived: cart totals ──────────────────────────────────────────────────────
  const totalItems = cart.reduce((sum, ci) => sum + ci.quantity, 0)
  const subtotal = cart.reduce((sum, ci) => sum + ci.unitPrice * ci.quantity, 0)
  const totalOfferDiscount = appliedOffers.reduce((sum, ao) => sum + ao.discountAmount, 0)

  const billDiscountAmount = useMemo(() => {
    const v = parseFloat(billDiscountValue) || 0
    if (v <= 0) return 0
    const base = Math.max(0, subtotal - totalOfferDiscount)
    if (billDiscountType === 'flat') return Math.min(v, base)
    return Math.round((base * Math.min(v, 100)) / 100)
  }, [billDiscountValue, billDiscountType, subtotal, totalOfferDiscount])

  const taxTotals = useMemo(() => {
    let inclusive = 0
    let exclusive = 0
    cart.forEach(ci => {
      const catItem = mockCatalogueItems.find(i => i.id === ci.catalogueItemId)
      const taxes = (catItem as any)?.taxes as { id: string; name: string; percentage: number }[] | undefined
      if (!taxes?.length) return
      const lineTotal = ci.unitPrice * ci.quantity
      taxes.forEach(tax => {
        if ((catItem as any).tax_inclusive) {
          inclusive += Math.round((lineTotal * tax.percentage) / (100 + tax.percentage))
        } else {
          exclusive += Math.round((lineTotal * tax.percentage) / 100)
        }
      })
    })
    return { inclusive, exclusive }
  }, [cart])

  const finalTotal = subtotal - totalOfferDiscount - billDiscountAmount + taxTotals.exclusive

  // ── Derived: locked cart items (used in offers) ───────────────────────────────
  const lockedCartItemIds = useMemo(
    () => new Set(appliedOffers.flatMap(ao => ao.cartItemIds)),
    [appliedOffers],
  )

  // ── Derived: available offers ─────────────────────────────────────────────────
  const availableOffers = useMemo(
    () =>
      evaluateOffers(
        cart,
        mockOffers,
        appliedOffers.map(ao => ao.offerId),
        lockedCartItemIds,
      ),
    [cart, appliedOffers, lockedCartItemIds],
  )

  // ── Derived: cart item IDs for quick lookup ───────────────────────────────────
  const cartItemsByProduct = useMemo(() => {
    const map: Record<string, number> = {}
    cart.forEach(ci => {
      map[ci.catalogueItemId] = (map[ci.catalogueItemId] || 0) + ci.quantity
    })
    return map
  }, [cart])

  // ── Stock helpers ─────────────────────────────────────────────────────────────
  function getRemainingStock(stockKey: string): number {
    const base = stockLevels[stockKey] ?? 0
    const inCart = cart
      .filter(ci => ci.stockKey === stockKey)
      .reduce((sum, ci) => sum + ci.quantity, 0)
    return base - inCart
  }

  function getCartItemStock(item: CartItem): number | null {
    if (!item.stockKey) return null
    return getRemainingStock(item.stockKey)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleItemClick(itemId: string) {
    const item = activeItems.find(i => i.id === itemId)
    if (!item) return

    const variants = getAvailableVariants(item)
    if (variants.length > 0) {
      setVariantPickerItemId(itemId)
    } else {
      let stockKey: string | null = null
      if (item.inventory_tracking && item.inventory_item_id) {
        stockKey = item.inventory_item_id
      }
      addToCartWithStockCheck(item, null, null, stockKey)
    }
  }

  function handleVariantSelect(
    item: typeof mockCatalogueItems[0],
    variant: VariantInfo,
  ) {
    setVariantPickerItemId(null)
    addToCartWithStockCheck(item, variant.id, variant.label, variant.stockKey)
  }

  function addToCartWithStockCheck(
    item: typeof mockCatalogueItems[0],
    variantId: string | null,
    variantLabel: string | null,
    stockKey: string | null,
  ) {
    if (stockKey) {
      const remaining = getRemainingStock(stockKey)

      if (remaining <= -5) {
        showToast(
          `Negative limit reached for ${item.name}${variantLabel ? ' — ' + variantLabel : ''}`,
          'danger',
        )
        return
      }

      if (remaining <= 0 && !seenStockWarnings.has(stockKey)) {
        setStockWarningModal({
          itemName: item.name,
          variantLabel,
          stockKey,
          pendingItem: item,
          pendingVariantId: variantId,
          pendingVariantLabel: variantLabel,
        })
        return
      }
    }

    doAddToCart(item, variantId, variantLabel, stockKey)
  }

  function doAddToCart(
    item: typeof mockCatalogueItems[0],
    variantId: string | null,
    variantLabel: string | null,
    stockKey: string | null,
  ) {
    setCart(prev => {
      const existing = prev.find(
        ci =>
          ci.catalogueItemId === item.id &&
          ci.variantId === (variantId || null),
      )
      if (existing) {
        return prev.map(ci =>
          ci.id === existing.id ? { ...ci, quantity: ci.quantity + 1 } : ci,
        )
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          catalogueItemId: item.id,
          name: item.name,
          variantId: variantId || null,
          variantLabel: variantLabel || null,
          stockKey: stockKey || null,
          quantity: 1,
          unitPrice: item.selling_price,
        },
      ]
    })
  }

  function confirmStockWarning() {
    if (!stockWarningModal) return
    const { stockKey, pendingItem, pendingVariantId, pendingVariantLabel } = stockWarningModal
    setSeenStockWarnings(prev => { const next = new Set(prev); next.add(stockKey); return next })
    doAddToCart(pendingItem, pendingVariantId, pendingVariantLabel, stockKey)
    setStockWarningModal(null)
  }

  function updateCartQty(cartItemId: string, delta: number) {
    setCart(prev => {
      return prev
        .map(ci => {
          if (ci.id !== cartItemId) return ci
          const newQty = ci.quantity + delta

          if (delta > 0 && ci.stockKey) {
            const remaining = getRemainingStock(ci.stockKey)
            if (remaining <= -5) {
              showToast(`Negative limit reached for ${ci.name}`, 'danger')
              return ci
            }
            if (remaining <= 0 && !seenStockWarnings.has(ci.stockKey)) {
              setSeenStockWarnings(p => { const next = new Set(p); next.add(ci.stockKey!); return next })
              showToast(`Stock is insufficient for ${ci.name}`, 'warning')
            }
          }

          if (newQty <= 0) return null
          return { ...ci, quantity: newQty }
        })
        .filter(Boolean) as CartItem[]
    })
  }

  function removeFromCart(cartItemId: string) {
    setCart(prev => prev.filter(ci => ci.id !== cartItemId))
  }

  function clearCart() {
    setCart([])
    setAppliedOffers([])
  }

  function quickAddStock(stockKey: string, amount: number) {
    setStockLevels(prev => ({
      ...prev,
      [stockKey]: (prev[stockKey] ?? 0) + amount,
    }))
    showToast(`Added ${amount} to stock`, 'success')
  }

  // ── Offer handlers ────────────────────────────────────────────────────────────

  function applyOffer(offerId: string) {
    const offer = mockOffers.find(o => o.id === offerId)
    if (!offer) return

    const eligibleItems = cart
      .filter(
        ci =>
          offer.applicable_item_ids.includes(ci.catalogueItemId) &&
          !lockedCartItemIds.has(ci.id),
      )
      .sort((a, b) => b.unitPrice - a.unitPrice)

    let remaining = offer.min_quantity
    const selectedIds: string[] = []
    const selectedItems: CartItem[] = []

    for (const item of eligibleItems) {
      if (remaining <= 0) break
      selectedIds.push(item.id)
      selectedItems.push(item)
      remaining -= item.quantity
    }

    if (remaining > 0) return

    const discount = calculateOfferDiscount(selectedItems, offer)

    setAppliedOffers(prev => [
      ...prev,
      {
        offerId: offer.id,
        offerName: offer.name,
        cartItemIds: selectedIds,
        discountAmount: discount,
      },
    ])
    showToast(`${offer.name} applied — Save ${formatINR(discount)}`, 'success')
  }

  function removeOffer(offerId: string) {
    setAppliedOffers(prev => prev.filter(ao => ao.offerId !== offerId))
    showToast('Offer removed', 'info')
  }

  // ── Checkout ──────────────────────────────────────────────────────────────────

  function handleCheckout() {
    // Deduct stock for all cart items
    const newLevels = { ...stockLevels }
    cart.forEach(ci => {
      if (ci.stockKey && newLevels[ci.stockKey] !== undefined) {
        newLevels[ci.stockKey] -= ci.quantity
      }
    })
    setStockLevels(newLevels)

    setCart([])
    setAppliedOffers([])
    setShowCheckout(false)
    setSeenStockWarnings(new Set())
    setBillDiscountValue('')
    showToast(`Sale completed — ${formatINR(finalTotal)}`, 'success')
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const variantPickerItem = variantPickerItemId
    ? activeItems.find(i => i.id === variantPickerItemId) ?? null
    : null

  const variantPickerVariants = variantPickerItem
    ? getAvailableVariants(variantPickerItem)
    : []

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.posWrap}>
      {/* ══════════════ LEFT PANEL — Item Selection ══════════════ */}
      <div className={styles.leftPanel}>
        <div className={styles.leftHeader}>
          {/* Search */}
          <div className={styles.searchRow}>
            <Search size={16} className={styles.searchIcon} />
            <input
              ref={searchRef}
              className={`form-input ${styles.searchInput}`}
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category pills */}
          <div className={styles.categoryPills}>
            <button
              className={`${styles.categoryPill} ${
                !activeCategory ? styles.categoryPillActive : ''
              }`}
              onClick={() => setActiveCategory('')}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                className={`${styles.categoryPill} ${
                  activeCategory === cat ? styles.categoryPillActive : ''
                }`}
                onClick={() =>
                  setActiveCategory(activeCategory === cat ? '' : cat)
                }
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Item grid */}
        <div className={styles.itemGrid}>
          {filteredItems.length === 0 ? (
            <div className={styles.noItems}>
              <p className={styles.noItemsTitle}>No items found</p>
              <p className={styles.noItemsDesc}>Try adjusting your search or filter</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const inCartQty = cartItemsByProduct[item.id] || 0
              const variants = getAvailableVariants(item)
              return (
                <div
                  key={item.id}
                  className={`${styles.itemCard} ${
                    inCartQty > 0 ? styles.itemCardInCart : ''
                  }`}
                  onClick={() => handleItemClick(item.id)}
                >
                  <div className={styles.itemCardName}>{item.name}</div>
                  <div className={styles.itemCardCategory}>
                    {item.category_name}
                    {variants.length > 0 && (
                      <> &middot; {variants.length} variants</>
                    )}
                  </div>
                  <div className={styles.itemCardBottom}>
                    <span className={styles.itemCardPrice}>
                      {formatINR(item.selling_price)}
                    </span>
                    {inCartQty > 0 ? (
                      <span className={styles.itemCardQty}>{inCartQty}</span>
                    ) : !item.inventory_tracking ? (
                      <span className={styles.itemCardBadge}>Service</span>
                    ) : item.is_bundle ? (
                      <span className={styles.itemCardBadge}>Bundle</span>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ══════════════ RIGHT PANEL — Cart ══════════════ */}
      <div className={styles.rightPanel}>
        {/* Cart header */}
        <div className={styles.cartHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className={styles.cartTitle}>Cart</span>
            {totalItems > 0 && (
              <span className={styles.cartCount}>{totalItems}</span>
            )}
          </div>
          {cart.length > 0 && (
            <button className={styles.clearCartBtn} onClick={clearCart}>
              Clear
            </button>
          )}
        </div>

        {/* Cart body */}
        <div className={styles.cartBody}>
          {cart.length === 0 ? (
            <div className={styles.cartEmpty}>
              <ShoppingCart size={40} className={styles.cartEmptyIcon} />
              <p className={styles.cartEmptyText}>
                Tap items to add them to the cart
              </p>
            </div>
          ) : (
            <>
              {/* Cart items */}
              {cart.map(ci => {
                const stockRemaining = getCartItemStock(ci)
                const isInOffer = lockedCartItemIds.has(ci.id)
                const offerName = appliedOffers.find(ao =>
                  ao.cartItemIds.includes(ci.id),
                )?.offerName

                return (
                  <div key={ci.id} className={styles.cartItem}>
                    <div className={styles.cartItemInfo}>
                      <div className={styles.cartItemName}>{ci.name}</div>
                      {ci.variantLabel && (
                        <div className={styles.cartItemVariant}>
                          {ci.variantLabel}
                        </div>
                      )}
                      {isInOffer && offerName && (
                        <div className={styles.cartItemOfferBadge}>
                          <Tag size={10} />
                          Used in {offerName}
                        </div>
                      )}
                      {!ci.stockKey && ci.catalogueItemId && (
                        (() => {
                          const catItem = activeItems.find(i => i.id === ci.catalogueItemId)
                          return catItem && !catItem.inventory_tracking ? (
                            <div className={styles.cartItemVariant}>
                              Tracking OFF
                            </div>
                          ) : null
                        })()
                      )}
                      {stockRemaining !== null && stockRemaining <= 0 && (
                        <div
                          className={`${styles.stockWarningInline} ${
                            stockRemaining <= -3 ? styles.stockDanger : ''
                          }`}
                        >
                          <AlertTriangle size={11} />
                          <span>
                            Stock: {stockRemaining}
                          </span>
                          <button
                            className={styles.quickAddBtn}
                            onClick={e => {
                              e.stopPropagation()
                              quickAddStock(ci.stockKey!, 5)
                            }}
                          >
                            +5
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={styles.cartItemRight}>
                      <span className={styles.cartItemPrice}>
                        {formatINR(ci.unitPrice * ci.quantity)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <div className={styles.cartItemControls}>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => updateCartQty(ci.id, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span className={styles.qtyValue}>{ci.quantity}</span>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => updateCartQty(ci.id, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button
                          className={styles.cartItemRemove}
                          onClick={() => removeFromCart(ci.id)}
                          title="Remove item"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* ── Available Offers ── */}
              {availableOffers.length > 0 && (
                <div className={styles.offersSection}>
                  <div className={styles.offersSectionTitle}>
                    Available Offers
                  </div>
                  {availableOffers.map(ev => (
                    <div
                      key={ev.offerId}
                      className={`${styles.offerCard} ${
                        ev.status === 'eligible'
                          ? styles.offerCardAvailable
                          : styles.offerCardPartial
                      }`}
                    >
                      <div className={styles.offerCardTop}>
                        <div>
                          <div className={styles.offerCardText}>
                            {ev.status === 'eligible'
                              ? `${ev.offerName} — Save ${formatINR(ev.potentialSavings)}`
                              : `Add ${ev.neededQty} more to unlock ${ev.offerName}`}
                          </div>
                          {ev.status === 'eligible' && (
                            <div className={styles.offerSavings}>
                              {benefitDescription(
                                mockOffers.find(o => o.id === ev.offerId)!,
                              )}
                            </div>
                          )}
                        </div>
                        {ev.status === 'eligible' && (
                          <div className={styles.offerCardActions}>
                            <button
                              className={styles.offerApplyBtn}
                              onClick={() => applyOffer(ev.offerId)}
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Applied Offers ── */}
              {appliedOffers.length > 0 && (
                <div className={styles.offersSection}>
                  <div className={styles.offersSectionTitle}>
                    Applied Offers
                  </div>
                  {appliedOffers.map(ao => (
                    <div
                      key={ao.offerId}
                      className={`${styles.offerCard} ${styles.offerCardApplied}`}
                    >
                      <div className={styles.offerCardTop}>
                        <div>
                          <div className={styles.offerCardText}>
                            {ao.offerName}
                          </div>
                          <div className={styles.offerSavings}>
                            Saving {formatINR(ao.discountAmount)}
                          </div>
                        </div>
                        <div className={styles.offerCardActions}>
                          <button
                            className={styles.offerRemoveBtn}
                            onClick={() => removeOffer(ao.offerId)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Cart footer */}
        <div className={styles.cartFooter}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Subtotal</span>
            <span className={styles.totalValue}>{formatINR(subtotal)}</span>
          </div>
          {totalOfferDiscount > 0 && (
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Offers</span>
              <span className={`${styles.totalValue} ${styles.totalDiscount}`}>
                -{formatINR(totalOfferDiscount)}
              </span>
            </div>
          )}

          {/* ── Bill Discount ── */}
          {cart.length > 0 && (
            <div className={styles.discountSection}>
              <div className={styles.discountHeader}>
                <span className={styles.discountLabel}>
                  <Percent size={11} />
                  Bill Discount
                </span>
                <div className={styles.discountTypeTabs}>
                  <button
                    className={`${styles.discountTypeBtn} ${billDiscountType === 'percent' ? styles.discountTypeBtnActive : ''}`}
                    onClick={() => { setBillDiscountType('percent'); setBillDiscountValue('') }}
                  >
                    % Off
                  </button>
                  <button
                    className={`${styles.discountTypeBtn} ${billDiscountType === 'flat' ? styles.discountTypeBtnActive : ''}`}
                    onClick={() => { setBillDiscountType('flat'); setBillDiscountValue('') }}
                  >
                    ₹ Flat
                  </button>
                </div>
              </div>
              <input
                className={`form-input ${styles.discountInput}`}
                type="number"
                min="0"
                max={billDiscountType === 'percent' ? 100 : undefined}
                placeholder={billDiscountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                value={billDiscountValue}
                onChange={e => setBillDiscountValue(e.target.value)}
              />
            </div>
          )}

          {billDiscountAmount > 0 && (
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>
                Bill Discount{billDiscountType === 'percent' ? ` (${billDiscountValue}%)` : ''}
              </span>
              <span className={`${styles.totalValue} ${styles.totalDiscount}`}>
                -{formatINR(billDiscountAmount)}
              </span>
            </div>
          )}
          {taxTotals.exclusive > 0 && (
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Tax</span>
              <span className={styles.totalValue}>+{formatINR(taxTotals.exclusive)}</span>
            </div>
          )}
          {taxTotals.inclusive > 0 && (
            <div className={`${styles.totalRow} ${styles.taxInclusiveLine}`}>
              <span className={styles.totalLabel}>Incl. Tax</span>
              <span className={styles.totalValue}>{formatINR(taxTotals.inclusive)}</span>
            </div>
          )}

          <div className={`${styles.totalRow} ${styles.totalFinal}`}>
            <span className={styles.totalFinalLabel}>Total</span>
            <span className={styles.totalFinalValue}>
              {formatINR(finalTotal)}
            </span>
          </div>
          <button
            className={styles.checkoutBtn}
            disabled={cart.length === 0}
            onClick={() => setShowCheckout(true)}
          >
            Complete Sale
          </button>
        </div>
      </div>

      {/* ══════════════ VARIANT PICKER OVERLAY ══════════════ */}
      {variantPickerItem && (
        <div
          className={styles.variantOverlay}
          onClick={() => setVariantPickerItemId(null)}
        >
          <div
            className={styles.variantPanel}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.variantTitle}>{variantPickerItem.name}</div>
            <div className={styles.variantSubtitle}>Select a variant</div>
            <div className={styles.variantOptions}>
              {variantPickerVariants.map(v => {
                const remaining = getRemainingStock(v.stockKey)
                const blocked = remaining <= -5
                return (
                  <div
                    key={v.id}
                    className={`${styles.variantOption} ${
                      blocked ? styles.variantOptionDisabled : ''
                    }`}
                    onClick={() => {
                      if (!blocked) {
                        handleVariantSelect(variantPickerItem, v)
                      }
                    }}
                  >
                    <span className={styles.variantOptionName}>{v.label}</span>
                    <span
                      className={`${styles.variantOptionStock} ${
                        remaining <= 0
                          ? styles.variantOptionStockOut
                          : remaining <= 3
                            ? styles.variantOptionStockLow
                            : ''
                      }`}
                    >
                      {blocked
                        ? 'Blocked'
                        : remaining <= 0
                          ? `Stock: ${remaining}`
                          : `${remaining} left`}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className={styles.variantCancel}>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setVariantPickerItemId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ STOCK WARNING MODAL ══════════════ */}
      {stockWarningModal && (
        <div className="modal-overlay" onClick={() => setStockWarningModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className={styles.stockModalContent}>
              <AlertTriangle size={28} className={styles.stockModalIcon} />
              <h3 className="modal__title">Stock is insufficient</h3>
              <p className="modal__body">
                {stockWarningModal.itemName}
                {stockWarningModal.variantLabel &&
                  ` (${stockWarningModal.variantLabel})`}{' '}
                has insufficient stock. Continue adding to cart?
              </p>
              <div className="modal__actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => setStockWarningModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={confirmStockWarning}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ CHECKOUT MODAL ══════════════ */}
      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div
            className="modal"
            style={{ maxWidth: '440px' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="modal__title">Complete Sale</h3>

            <div className={styles.checkoutSummary}>
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>
                  Items ({totalItems})
                </span>
                <span className={styles.totalValue}>
                  {formatINR(subtotal)}
                </span>
              </div>
              {totalOfferDiscount > 0 && (
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Offers</span>
                  <span className={`${styles.totalValue} ${styles.totalDiscount}`}>
                    -{formatINR(totalOfferDiscount)}
                  </span>
                </div>
              )}
              {billDiscountAmount > 0 && (
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>
                    Bill Discount{billDiscountType === 'percent' ? ` (${billDiscountValue}%)` : ''}
                  </span>
                  <span className={`${styles.totalValue} ${styles.totalDiscount}`}>
                    -{formatINR(billDiscountAmount)}
                  </span>
                </div>
              )}
              {taxTotals.exclusive > 0 && (
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Tax</span>
                  <span className={styles.totalValue}>+{formatINR(taxTotals.exclusive)}</span>
                </div>
              )}
              {taxTotals.inclusive > 0 && (
                <div className={`${styles.totalRow} ${styles.taxInclusiveLine}`}>
                  <span className={styles.totalLabel}>Incl. Tax</span>
                  <span className={styles.totalValue}>{formatINR(taxTotals.inclusive)}</span>
                </div>
              )}
              <div
                className={styles.totalRow}
                style={{
                  paddingTop: 'var(--space-2)',
                  borderTop: '0.5px solid var(--color-border-default)',
                  marginTop: 'var(--space-1)',
                }}
              >
                <span className={styles.totalFinalLabel}>Total</span>
                <span className={styles.totalFinalValue}>
                  {formatINR(finalTotal)}
                </span>
              </div>
            </div>

            <label
              className="form-label"
              style={{ marginBottom: 'var(--space-2)' }}
            >
              Payment Method
            </label>
            <div className={styles.paymentMethods}>
              <button
                className={`${styles.paymentMethod} ${
                  paymentMethod === 'cash' ? styles.paymentMethodActive : ''
                }`}
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote size={16} style={{ marginBottom: 4 }} />
                <div>Cash</div>
              </button>
              <button
                className={`${styles.paymentMethod} ${
                  paymentMethod === 'upi' ? styles.paymentMethodActive : ''
                }`}
                onClick={() => setPaymentMethod('upi')}
              >
                <Smartphone size={16} style={{ marginBottom: 4 }} />
                <div>UPI</div>
              </button>
            </div>

            {/* UPI QR code */}
            {paymentMethod === 'upi' && (
              <div className={styles.upiQrWrap}>
                <QRCodeSVG
                  value={`upi://pay?pa=${mockUser.email}&pn=${encodeURIComponent(mockUser.business_name)}&am=${finalTotal}&cu=INR`}
                  size={160}
                  className={styles.upiQrCode}
                />
                <div className={styles.upiQrLabel}>
                  Scan to pay {formatINR(finalTotal)}
                </div>
                <div className={styles.upiQrId}>{mockUser.email}</div>
              </div>
            )}

            <div className="modal__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setShowCheckout(false)}
              >
                Cancel
              </button>
              <button className="btn btn--primary" onClick={handleCheckout}>
                Confirm Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TOAST ══════════════ */}
      {toast && (
        <div className={styles.toastWrap}>
          <div className="toast">
            <div
              className={`toast__bar toast__bar--${
                toast.type === 'danger'
                  ? 'danger'
                  : toast.type === 'warning'
                    ? 'warning'
                    : toast.type === 'success'
                      ? 'success'
                      : 'info'
              }`}
            />
            <div>
              <div className="toast__text">{toast.message}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
