'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Building2,
  Landmark,
  Upload,
  Receipt,
  FolderOpen,
  ClipboardList,
  BarChart3,
  LineChart,
  CalendarCheck,
  Calculator,
  Package,
  AlertCircle,
  Settings,
  Activity,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',            icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/clients',              icon: Users,           label: 'Clients' },
  { href: '/entities',             icon: Building2,       label: 'Entities' },
  { href: '/bank-accounts',        icon: Landmark,        label: 'Bank Accounts' },
  { href: '/imports',              icon: Upload,          label: 'Imports' },
  { href: '/transactions',         icon: Receipt,         label: 'Transactions' },
  { href: '/documents',            icon: FolderOpen,      label: 'Documents' },
  { href: '/accounting-assistant', icon: ClipboardList,   label: 'Work Assistant' },
  { href: '/monthly-close',        icon: CalendarCheck,   label: 'Monthly Close' },
  { href: '/pnl',                  icon: LineChart,       label: 'P&L' },
  { href: '/tax-prep',             icon: Calculator,      label: 'Tax Prep' },
  { href: '/auditor-pack',         icon: Package,         label: 'Auditor Pack' },
  { href: '/unresolved-issues',    icon: AlertCircle,     label: 'Issues' },
]

const bottomItems = [
  { href: '/settings',      icon: Settings,  label: 'Settings' },
  { href: '/activity-log',  icon: Activity,  label: 'Activity Log' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-card border-r border-border flex flex-col py-6">
      {/* Logo */}
      <div className="px-4 mb-8">
        <h1 className="text-card-title text-ink-primary font-bold tracking-tight">
          AcctSystem
        </h1>
        <p className="text-label text-ink-muted mt-0.5">Work Replacement</p>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(isActive ? 'nav-item-active' : 'nav-item')}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Nav */}
      <nav className="px-3 space-y-0.5 mt-4 pt-4 border-t border-divider">
        {bottomItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(isActive ? 'nav-item-active' : 'nav-item')}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
