import Sidebar from '@/components/layout/Sidebar'
import ConditionalTopBar from '@/components/layout/ConditionalTopBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <ConditionalTopBar />
        <main className="page-body">
          {children}
        </main>
      </div>
    </div>
  )
}
