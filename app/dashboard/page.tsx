'use client'

import Link from 'next/link'
import { mockUser, mockDashboardStats, formatINR } from '@/lib/mock-data'
import styles from './dashboard.module.css'

type TimeContext = 'morning' | 'afternoon' | 'evening' | 'night'

const contextConfig: Record<TimeContext, { greeting: string; subtitle: string; icon: string }> = {
  morning: {
    greeting: 'Good morning',
    subtitle: 'Here is your opening checklist',
    icon: '◐',
  },
  afternoon: {
    greeting: 'Good afternoon',
    subtitle: 'Here is how today is going',
    icon: '○',
  },
  evening: {
    greeting: 'Good evening',
    subtitle: "Here is today's summary",
    icon: '●',
  },
  night: {
    greeting: 'Plan for tomorrow',
    subtitle: 'Here is what needs attention before opening',
    icon: '◑',
  },
}

export default function DashboardPage() {
  const hour = new Date().getHours()
  const { morning_start, afternoon_start, evening_start, night_start } = mockUser.operating_hours

  const getTimeContext = (): TimeContext => {
    if (hour >= morning_start && hour < afternoon_start) return 'morning'
    if (hour >= afternoon_start && hour < evening_start) return 'afternoon'
    if (hour >= evening_start && hour < night_start) return 'evening'
    return 'night'
  }

  const timeContext = getTimeContext()
  const ctx = contextConfig[timeContext]

  const {
    todayRevenue,
    todayTransactions,
    todayProfit,
    inventoryWorth,
    lowStockCount,
    lowStockItems,
    topSellingItems,
  } = mockDashboardStats

  const pacePercent = 83

  return (
    <div>
      {/* 1. PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1>
            {ctx.greeting}, {mockUser.name.split(' ')[0]}
          </h1>
          <p className="text-secondary">{ctx.subtitle}</p>
        </div>
      </div>

      {/* 2. METRIC CARDS */}
      <div className="grid-4">
        <div className="metric-card">
          <div className="metric-card__band metric-card__band--blue"></div>
          <div className="metric-card__body">
            <p className="metric-card__label">Today's Revenue</p>
            <p className="metric-card__value metric-card__value--blue">
              {formatINR(todayRevenue)}
            </p>
            <p className="metric-card__sub">{todayTransactions} transactions today</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__band metric-card__band--green"></div>
          <div className="metric-card__body">
            <p className="metric-card__label">Today's Profit</p>
            <p className="metric-card__value metric-card__value--green">
              {formatINR(todayProfit)}
            </p>
            <p className="metric-card__sub">Simple items only</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__band metric-card__band--amber"></div>
          <div className="metric-card__body">
            <p className="metric-card__label">Low Stock Alerts</p>
            <p className="metric-card__value metric-card__value--amber">{lowStockCount}</p>
            <p className="metric-card__sub">Items need restocking</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__band metric-card__band--navy"></div>
          <div className="metric-card__body">
            <p className="metric-card__label">Stock Worth</p>
            <p className="metric-card__value">{formatINR(inventoryWorth)}</p>
            <p className="metric-card__sub">Total stock value</p>
          </div>
        </div>
      </div>

      {/* 3. CONTEXT SECTION */}
      <div className={styles.contextSection}>
        {timeContext === 'morning' && (
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Opening checklist</h3>
              <span className="badge badge--info">Morning</span>
            </div>
            {lowStockItems.map((item) => (
              <div key={item.name} className={styles.checkRow}>
                <input type="checkbox" className={styles.checkBox} readOnly />
                <div className={styles.checkItem}>
                  <span>{item.name}</span>
                  <span className="badge badge--warning">Low</span>
                </div>
                <span className={`${styles.checkStock} text-secondary`}>
                  {item.current_stock} / {item.par_stock} {item.unit}
                </span>
              </div>
            ))}
            <Link href="/dashboard/inventory" className={`${styles.ctaLink} text-brand`}>
              Review inventory →
            </Link>
          </div>
        )}

        {timeContext === 'afternoon' && (
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Sales pace today</h3>
              <span className="badge badge--success">Live</span>
            </div>
            <div className={styles.paceList}>
              <p>{formatINR(todayRevenue)} earned so far</p>
              <p className="text-secondary">{todayTransactions} sales recorded</p>
              <p className="text-secondary">Top seller: {topSellingItems[0].name}</p>
            </div>
            <div className={styles.paceBarWrap}>
              <div className={styles.paceBarTrack}>
                <div
                  className={styles.paceBarFill}
                  style={{ width: `${pacePercent}%` }}
                />
              </div>
              <span className={`${styles.pacePct} text-secondary`}>{pacePercent}% of yesterday</span>
            </div>
          </div>
        )}

        {timeContext === 'evening' && (
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Today's summary</h3>
              <span className="badge badge--neutral">End of day</span>
            </div>
            <div className={styles.summaryList}>
              <div className={styles.summaryRow}>
                <span className="text-secondary">Total Revenue</span>
                <span>{formatINR(todayRevenue)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className="text-secondary">Total Profit</span>
                <span className="text-success">{formatINR(todayProfit)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className="text-secondary">Sales count</span>
                <span>{todayTransactions}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className="text-secondary">Top item</span>
                <span>{topSellingItems[0].name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className="text-secondary">Low stock items</span>
                <span className="text-warning">{lowStockCount} flagged</span>
              </div>
            </div>
          </div>
        )}

        {timeContext === 'night' && (
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Tomorrow's prep</h3>
              <span className="badge badge--neutral">Night</span>
            </div>
            {lowStockItems.map((item) => (
              <div key={item.name} className={styles.reorderRow}>
                <div className={styles.reorderInfo}>
                  <span className={`${styles.reorderName} font-medium`}>{item.name}</span>
                  <p className="text-secondary">
                    Stock: {item.current_stock} {item.unit} — Par: {item.par_stock} {item.unit}
                  </p>
                </div>
                <span className="badge badge--warning">Reorder needed</span>
              </div>
            ))}
            <p className={`${styles.nightHint} text-secondary`}>
              Review and update stock before opening
            </p>
          </div>
        )}
      </div>

      {/* 4. TWO COLUMN ROW */}
      <div className={styles.twoCol}>
        {/* LEFT — Top Selling Items */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Top selling this month</h3>
            <span className="badge badge--neutral">This month</span>
          </div>
          {topSellingItems.map((item, index) => (
            <div key={item.name} className={styles.rankRow}>
              <span className={`${styles.rankNum} text-tertiary font-medium`}>{index + 1}</span>
              <span className={styles.rankName}>{item.name}</span>
              <span className={`${styles.rankUnits} text-secondary`}>{item.quantity} units</span>
              <span className={`${styles.rankRevenue} text-tertiary`}>{formatINR(item.revenue)}</span>
            </div>
          ))}
        </div>

        {/* RIGHT — Low Stock Alerts */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Low stock alerts</h3>
            <span className="badge badge--warning">{lowStockCount} items</span>
          </div>
          {lowStockCount > 0 ? (
            lowStockItems.map((item) => (
              <div key={item.name} className={styles.stockRow}>
                <div className={styles.stockItemName}>
                  <span>{item.name}</span>
                  <span className="badge badge--warning">Low</span>
                </div>
                <p className={`${styles.stockDetail} text-secondary`}>
                  Current: {item.current_stock} {item.unit}
                </p>
                <p className={`${styles.stockDetail} text-secondary`}>
                  Par: {item.par_stock} {item.unit}
                </p>
                <Link href="/dashboard/inventory" className={`${styles.stockLink} text-brand`}>
                  Update stock →
                </Link>
              </div>
            ))
          ) : (
            <div className="alert alert--success">
              <div className="alert__dot"></div>
              <div>
                <p className="alert__title">All stock levels healthy</p>
                <p className="alert__body">No items below par stock.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. PRO ANALYTICS TEASER */}
      <div className={styles.proSection}>
        <div className={styles.proHeader}>
          <h2>Full Analytics</h2>
          <span className="badge badge--navy">Pro</span>
        </div>

        {mockUser.subscription_plan === 'free' ? (
          <div className={styles.blurWrap}>
            <div className={styles.blurContent}>
              <div className={styles.chartPlaceholder}>
                <p className="text-tertiary">Revenue over time</p>
              </div>
              <div className={styles.chartPlaceholder}>
                <p className="text-tertiary">Profit by category</p>
              </div>
              <div className={styles.chartPlaceholder}>
                <p className="text-tertiary">Payment method split</p>
              </div>
            </div>
            <div className={styles.upgradeOverlay}>
              <div className={`card ${styles.upgradeCard}`}>
                <p className={`${styles.upgradeTitle} font-medium`}>Unlock Full Analytics</p>
                <p className={`${styles.upgradeBody} text-secondary text-sm`}>
                  Get deep insights into revenue, profit, and sales patterns.
                </p>
                <Link href="/dashboard/settings/billing" className="btn btn--primary btn--full">
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="text-secondary">Full analytics are available with your Pro plan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
