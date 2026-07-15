'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Layers, ShoppingCart, TrendingUp, Info, ImageOff } from 'lucide-react'
import { mockInventoryItems, mockSuppliers, formatINR } from '@/lib/mock-data'
import styles from '../variant.module.css'

type Tab = 'overview' | 'purchases' | 'consumption' | 'pricing'

// Local shape matching the records the Inventory pages build up in session state —
// kept independent of types/database.ts since this is a UI-only mock build.
interface LocalVariant { id: string; code: string; attributes: string[]; quantity: number }
interface LocalItem {
  id: string
  name: string
  category: string
  unit: string
  cost_price: number
  mrp: number
  notes: string | null
  attributes: string[]
  variants?: LocalVariant[]
}

// Deterministic pseudo-random generator seeded from a string — keeps demo
// numbers stable across renders/navigations without needing shared state.
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function VariantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string
  const variantId = params.variantId as string

  const item = (mockInventoryItems as unknown as LocalItem[]).find(i => i.id === itemId) ?? null
  const variant = item?.variants?.find(v => v.id === variantId) ?? null

  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const displayName = item
    ? `${item.name}${variant?.code ? ` — ${variant.code}` : ''}`
    : 'Variant'

  // ── Demo data, deterministically generated from the variant/item id ──────
  const rand = useMemo(() => seededRandom(variantId || itemId || 'demo'), [variantId, itemId])

  const baseCost = item?.cost_price && item.cost_price > 0 ? item.cost_price : 400 + Math.round(rand() * 300)
  const sellingPrice = item?.mrp && item.mrp > 0 ? item.mrp : Math.round(baseCost * 1.3)

  const purchaseHistory = useMemo(() => {
    const now = Date.now()
    const entries: { date: string; vendor: string; qty: number; unit_cost: number }[] = []
    let cost = baseCost * 0.9
    for (let i = 5; i >= 0; i--) {
      cost = cost * (0.96 + rand() * 0.12)
      const vendor = mockSuppliers[Math.floor(rand() * mockSuppliers.length)]
      entries.push({
        date: new Date(now - i * 22 * 86400000).toISOString(),
        vendor: vendor?.name ?? 'Unknown vendor',
        qty: 10 + Math.round(rand() * 40),
        unit_cost: Math.round(cost),
      })
    }
    return entries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCost, rand])

  const consumption = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { label: MONTHS[d.getMonth()], qty: 15 + Math.round(rand() * 60) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rand])

  const latestCost = purchaseHistory[purchaseHistory.length - 1]?.unit_cost ?? baseCost
  const prevCost = purchaseHistory[purchaseHistory.length - 2]?.unit_cost ?? latestCost
  const avgCost = Math.round(purchaseHistory.reduce((s, p) => s + p.unit_cost, 0) / purchaseHistory.length)
  const minCost = Math.min(...purchaseHistory.map(p => p.unit_cost))
  const maxCost = Math.max(...purchaseHistory.map(p => p.unit_cost))
  const trendPct = prevCost > 0 ? Math.round(((latestCost - prevCost) / prevCost) * 100) : 0

  const vendorStats = useMemo(() => {
    const byVendor = new Map<string, { qty: number; totalCost: number; count: number }>()
    purchaseHistory.forEach(p => {
      const cur = byVendor.get(p.vendor) ?? { qty: 0, totalCost: 0, count: 0 }
      cur.qty += p.qty
      cur.totalCost += p.qty * p.unit_cost
      cur.count += 1
      byVendor.set(p.vendor, cur)
    })
    return Array.from(byVendor.entries()).map(([vendor, s]) => ({
      vendor,
      orders: s.count,
      avgCost: Math.round(s.totalCost / s.qty),
      totalQty: s.qty,
    }))
  }, [purchaseHistory])

  const maxChartCost = Math.max(...purchaseHistory.map(p => p.unit_cost))
  const maxConsumptionQty = Math.max(...consumption.map(c => c.qty))

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <button className={styles.backArrow} onClick={() => router.push(`/dashboard/inventory/${itemId}`)} title="Back to item">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={styles.variantTitle}>{displayName}</h1>
            <div className={styles.variantMeta}>
              {variant?.code && <span className={styles.variantCode}>{variant.code}</span>}
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{item?.category ?? 'Uncategorized'}</span>
              <span className={styles.metaDot} />
              <span className={styles.metaText}>{variant?.quantity ?? 0} {item?.unit ?? 'units'} in stock</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('overview')}>
          <Info size={14} style={{ marginRight: 6 }} /> Overview
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'purchases' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('purchases')}>
          <Layers size={14} style={{ marginRight: 6 }} /> Purchase Orders
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'consumption' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('consumption')}>
          <ShoppingCart size={14} style={{ marginRight: 6 }} /> Consumption
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'pricing' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('pricing')}>
          <TrendingUp size={14} style={{ marginRight: 6 }} /> Price Intelligence
        </button>
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className={styles.overviewGrid}>
          <div className={styles.imagePlaceholder}>
            <ImageOff size={32} />
          </div>
          <div className={styles.overviewDetails}>
            {item?.attributes && item.attributes.length > 0 && (
              <div>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Attributes</label>
                <div className={styles.attrChipsRow}>
                  {item.attributes.map((attr, i) => (
                    <span key={attr} className={styles.attrChip}>{attr}: {variant?.attributes[i] || '—'}</span>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.pricingRow}>
              <div className={styles.pricingCard}>
                <span className="text-secondary text-sm">Cost price</span>
                <span className={styles.pricingValue}>{formatINR(baseCost)}</span>
              </div>
              <div className={styles.pricingCard}>
                <span className="text-secondary text-sm">Selling price</span>
                <span className={styles.pricingValue}>{formatINR(sellingPrice)}</span>
              </div>
              <div className={styles.pricingCard}>
                <span className="text-secondary text-sm">Margin</span>
                <span className={styles.pricingValue}>{Math.round(((sellingPrice - baseCost) / sellingPrice) * 100)}%</span>
              </div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Description</label>
              <p className={styles.descText}>
                {item?.notes || 'No description added yet — this is used on the storefront when this product is published.'}
              </p>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Stock by Branch</label>
              <table className={`data-table ${styles.stockByBranchTable}`}>
                <thead><tr><th>Branch</th><th style={{ textAlign: 'right' }}>Stock</th></tr></thead>
                <tbody>
                  <tr><td>Main Branch</td><td style={{ textAlign: 'right' }}>{variant?.quantity ?? 0} {item?.unit ?? ''}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Orders */}
      {activeTab === 'purchases' && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Purchase History</span>
            <span className="text-sm text-secondary">{purchaseHistory.length} purchases</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vendor</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Cost</th>
                <th style={{ textAlign: 'right' }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {[...purchaseHistory].reverse().map((p, i) => (
                <tr key={i}>
                  <td>{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{p.vendor}</td>
                  <td style={{ textAlign: 'right' }}>{p.qty}</td>
                  <td style={{ textAlign: 'right' }}>{formatINR(p.unit_cost)}</td>
                  <td style={{ textAlign: 'right' }}>{formatINR(p.qty * p.unit_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Consumption */}
      {activeTab === 'consumption' && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Consumption — Last 6 Months</span>
            <span className="text-sm text-secondary">
              Total: {consumption.reduce((s, c) => s + c.qty, 0)} {item?.unit ?? 'units'}
            </span>
          </div>
          <div className={styles.chartWrap}>
            {consumption.map(c => (
              <div key={c.label} className={styles.chartBarCol}>
                <span className={styles.chartBarValue}>{c.qty}</span>
                <div className={styles.chartBar} style={{ height: `${(c.qty / maxConsumptionQty) * 100}%` }} />
                <span className={styles.chartBarLabel}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Intelligence */}
      {activeTab === 'pricing' && (
        <div>
          <div className={styles.metricRow}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Latest Cost</span>
              <span className={styles.metricValue}>{formatINR(latestCost)}</span>
              <span className={`${styles.metricSub} ${styles.priceTrend} ${trendPct > 0 ? styles.priceUp : trendPct < 0 ? styles.priceDown : styles.priceFlat}`}>
                {trendPct > 0 ? '▲' : trendPct < 0 ? '▼' : '—'} {Math.abs(trendPct)}% vs last purchase
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Average Cost</span>
              <span className={styles.metricValue}>{formatINR(avgCost)}</span>
              <span className={styles.metricSub}>across last {purchaseHistory.length} purchases</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Lowest Cost</span>
              <span className={styles.metricValue}>{formatINR(minCost)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Highest Cost</span>
              <span className={styles.metricValue}>{formatINR(maxCost)}</span>
            </div>
          </div>

          <div className={styles.panel} style={{ marginBottom: 'var(--space-5)' }}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Cost Trend</span>
            </div>
            <div className={styles.chartWrap}>
              {purchaseHistory.map((p, i) => (
                <div key={i} className={styles.chartBarCol}>
                  <span className={styles.chartBarValue}>{formatINR(p.unit_cost)}</span>
                  <div className={styles.chartBar} style={{ height: `${(p.unit_cost / maxChartCost) * 100}%` }} />
                  <span className={styles.chartBarLabel}>{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Vendor Comparison</span>
            </div>
            <table className={`data-table ${styles.vendorCompareTable}`}>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th style={{ textAlign: 'right' }}>Orders</th>
                  <th style={{ textAlign: 'right' }}>Total Qty Supplied</th>
                  <th style={{ textAlign: 'right' }}>Avg. Cost / Unit</th>
                </tr>
              </thead>
              <tbody>
                {[...vendorStats].sort((a, b) => a.avgCost - b.avgCost).map(v => (
                  <tr key={v.vendor}>
                    <td>{v.vendor}</td>
                    <td style={{ textAlign: 'right' }}>{v.orders}</td>
                    <td style={{ textAlign: 'right' }}>{v.totalQty}</td>
                    <td style={{ textAlign: 'right' }}>{formatINR(v.avgCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
