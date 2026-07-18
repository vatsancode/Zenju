'use client'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'

// Inventory detail pages (/dashboard/inventory/<id> and its variant sub-page)
// and the purchase order create/detail pages get no top bar — they use the
// full viewport without the sticky header.
const HIDE_TOPBAR = /^\/dashboard\/inventory\/[^/]+(\/variant\/[^/]+)?$|^\/dashboard\/purchases\/[^/]+$/

export default function ConditionalTopBar() {
  const pathname = usePathname()
  if (HIDE_TOPBAR.test(pathname)) return null
  return <TopBar />
}
