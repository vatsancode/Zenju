import { redirect } from 'next/navigation'

// Root route — redirect to dashboard (auth guard handled in dashboard layout)
export default function RootPage() {
  redirect('/dashboard')
}
