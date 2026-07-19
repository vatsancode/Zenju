import Sidebar from '@/components/layout/Sidebar'
import ConditionalTopBar from '@/components/layout/ConditionalTopBar'
import { PageTitleProvider } from '@/components/layout/PageTitleContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageTitleProvider>
      <div className="dashboard-layout">
        <Sidebar />
        <div className="main-content">
          <ConditionalTopBar />
          <main className="page-body">
            {children}
          </main>
        </div>
      </div>
    </PageTitleProvider>
  )
}
