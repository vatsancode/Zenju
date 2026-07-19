'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type PageTitleContextValue = {
  title: string
  setTitle: (title: string) => void
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState('')
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  )
}

// Read the current page title (used by the top bar).
export function usePageTitle() {
  const ctx = useContext(PageTitleContext)
  if (!ctx) throw new Error('usePageTitle must be used within a PageTitleProvider')
  return ctx.title
}

// Set the page title from a page component. Clears on unmount.
export function useSetPageTitle(title: string) {
  const ctx = useContext(PageTitleContext)
  if (!ctx) throw new Error('useSetPageTitle must be used within a PageTitleProvider')
  const { setTitle } = ctx
  useEffect(() => {
    setTitle(title)
    return () => setTitle('')
  }, [title, setTitle])
}
