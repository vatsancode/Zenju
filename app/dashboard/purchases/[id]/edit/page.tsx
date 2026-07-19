'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { mockPurchaseOrders } from '@/lib/mock-data'
import PurchaseOrderForm from '@/components/purchases/PurchaseOrderForm'
import styles from '../../purchases.module.css'

export default function EditPurchaseOrderPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const po = mockPurchaseOrders.find(p => p.id === id) ?? null

  if (!po) {
    return (
      <div>
        <button className={styles.backArrow} onClick={() => router.push('/dashboard/purchases')} title="Back to Purchase Orders">
          <ArrowLeft size={16} />
        </button>
        <div className="empty-state">
          <p className="empty-state__title">Purchase order not found</p>
          <p className="empty-state__desc">The purchase order you are looking for does not exist.</p>
        </div>
      </div>
    )
  }

  return <PurchaseOrderForm editPo={po} />
}
