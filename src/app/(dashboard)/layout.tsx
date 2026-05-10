import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-none px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
