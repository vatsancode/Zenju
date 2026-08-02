import type { Metadata } from 'next'
import '@/styles/globals.css'
import StorageAccessGuard from '@/components/system/StorageAccessGuard'

export const metadata: Metadata = {
  title: 'ZenJu',
  description: 'Inventory and POS platform for small businesses in India',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      {/* Inline script runs before React hydration — prevents dark-mode flash */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <StorageAccessGuard>{children}</StorageAccessGuard>
      </body>
    </html>
  )
}
