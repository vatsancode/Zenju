'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './Pagination.module.css'

// Builds a windowed page list with '…' gap markers, e.g. [1, '…', 4, 5, 6, '…', 20]
function getPageWindow(current: number, total: number): (number | '…')[] {
  const pages: (number | '…')[] = []
  const window = 1

  const start = Math.max(2, current - window)
  const end = Math.min(total - 1, current + window)

  pages.push(1)
  if (start > 2) pages.push('…')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push('…')
  if (total > 1) pages.push(total)

  return pages
}

export default function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
}: {
  page: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  itemLabel?: string
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const clampedPage = Math.min(Math.max(1, page), totalPages)
  const rangeStart = totalItems === 0 ? 0 : (clampedPage - 1) * pageSize + 1
  const rangeEnd = Math.min(totalItems, clampedPage * pageSize)

  if (totalItems === 0) return null

  return (
    <div className={styles.wrap}>
      <span className={styles.summary}>
        Showing <strong>{rangeStart}–{rangeEnd}</strong> of <strong>{totalItems}</strong> {itemLabel}
      </span>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.navBtn}
          disabled={clampedPage === 1}
          onClick={() => onPageChange(clampedPage - 1)}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageWindow(clampedPage, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className={styles.ellipsis}>…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`${styles.pageBtn} ${p === clampedPage ? styles.pageBtnActive : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className={styles.navBtn}
          disabled={clampedPage === totalPages}
          onClick={() => onPageChange(clampedPage + 1)}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
