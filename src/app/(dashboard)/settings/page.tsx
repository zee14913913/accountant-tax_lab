export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Settings, Users, Tag, ClipboardList, Database } from 'lucide-react'

export default async function SettingsPage() {
  const [
    userCount,
    acctCatCount,
    taxCatCount,
    templateCount,
    clientCount,
    entityCount,
    transactionCount,
    auditLogCount,
  ] = await Promise.all([
    prisma.user.count({ where: { is_active: true } }),
    prisma.accountingCategory.count({ where: { is_active: true } }),
    prisma.taxCategory.count({ where: { is_active: true } }),
    prisma.checklistTemplate.count({ where: { is_active: true } }),
    prisma.client.count({ where: { archived_at: null } }),
    prisma.entity.count({ where: { archived_at: null } }),
    prisma.transaction.count({ where: { archived_at: null } }),
    prisma.auditLog.count(),
  ])

  const users = await prisma.user.findMany({
    where: { is_active: true },
    orderBy: { created_at: 'asc' },
  })

  const acctCategories = await prisma.accountingCategory.findMany({
    where: { is_active: true, parent_id: null },
    include: { children: { where: { is_active: true } } },
    orderBy: [{ report_group: 'asc' }, { sort_order: 'asc' }],
  })

  const taxCategories = await prisma.taxCategory.findMany({
    where: { is_active: true },
    orderBy: { code: 'asc' },
  })

  const templates = await prisma.checklistTemplate.findMany({
    where: { is_active: true },
    orderBy: { flow_type: 'asc' },
  })

  const DEDUCTIBLE_LABELS: Record<string, string> = {
    FULLY_DEDUCTIBLE:    'Fully Deductible',
    PARTIALLY_DEDUCTIBLE:'Partially Deductible',
    NON_DEDUCTIBLE:      'Non-Deductible',
    CAPITAL_ALLOWANCE:   'Capital Allowance',
    PERSONAL_RELIEF:     'Personal Relief',
    NOT_APPLICABLE:      'N/A',
  }

  const FLOW_LABELS: Record<string, string> = {
    INDIVIDUAL_ONLY:     'Individual',
    INDIVIDUAL_BUSINESS: 'Indiv + Biz',
    PARTNERSHIP:         'Partnership',
    COMPANY:             'Company',
  }

  return (
    <div className="max-w-5xl">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">System configuration and reference data</p>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        {[
          { label: 'Clients',      value: clientCount,      icon: <Users size={16} /> },
          { label: 'Entities',     value: entityCount,      icon: <Database size={16} /> },
          { label: 'Transactions', value: transactionCount, icon: <ClipboardList size={16} /> },
          { label: 'Audit Logs',   value: auditLogCount,    icon: <Settings size={16} /> },
        ].map(s => (
          <Card key={s.label} size="sm">
            <div className="flex items-center gap-3">
              <div className="text-ink-muted">{s.icon}</div>
              <div>
                <p className="text-label text-ink-muted uppercase tracking-wide">{s.label}</p>
                <p className="text-section font-bold text-ink-primary tabular-nums">{s.value.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-1 space-y-6">
          {/* Users */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Users ({userCount})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-label text-ink-muted">No users configured.</p>
              ) : (
                <div className="space-y-3">
                  {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-body font-medium text-ink-primary">{user.name ?? '—'}</p>
                        <p className="text-label text-ink-muted">{user.email}</p>
                      </div>
                      <Badge variant={user.role === 'OWNER' ? 'success' : user.role === 'MANAGER' ? 'info' : 'neutral'}>
                        {user.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checklist Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Checklist Templates ({templateCount})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {templates.map(t => {
                  const items = Array.isArray(t.items_json) ? t.items_json : []
                  return (
                    <div key={t.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-label font-medium text-ink-primary">
                          {FLOW_LABELS[t.flow_type] ?? t.flow_type} — {t.phase}
                        </p>
                        <p className="text-label text-ink-muted">v{t.version} · {items.length} items</p>
                      </div>
                      <Badge variant="neutral">Active</Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 2 columns */}
        <div className="col-span-2 space-y-6">
          {/* Accounting Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Accounting Categories ({acctCatCount})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Group</th>
                      <th className="py-2.5 px-4 text-right">Sub-accounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acctCategories.map(cat => (
                      <tr key={cat.id}>
                        <td className="py-2 px-4">
                          <span className="font-mono text-label text-ink-secondary">{cat.code}</span>
                        </td>
                        <td className="py-2 px-4">
                          <p className="text-body text-ink-primary">{cat.name}</p>
                          {cat.name_zh && <p className="text-label text-ink-muted">{cat.name_zh}</p>}
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-label text-ink-muted">
                            {cat.report_group.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          <span className="text-label text-ink-secondary">{cat.children.length}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Tax Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Categories ({taxCatCount})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Deductible Type</th>
                      <th className="py-2.5 px-4">Applicable Forms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxCategories.map(cat => (
                      <tr key={cat.id}>
                        <td className="py-2 px-4">
                          <span className="font-mono text-label text-ink-secondary">{cat.code}</span>
                        </td>
                        <td className="py-2 px-4">
                          <p className="text-body text-ink-primary">{cat.name}</p>
                          {cat.name_zh && <p className="text-label text-ink-muted">{cat.name_zh}</p>}
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant={
                            cat.deductible_type === 'FULLY_DEDUCTIBLE' ? 'success' :
                            cat.deductible_type === 'NON_DEDUCTIBLE'   ? 'error' :
                            cat.deductible_type === 'PERSONAL_RELIEF'  ? 'info' : 'neutral'
                          }>
                            {DEDUCTIBLE_LABELS[cat.deductible_type] ?? cat.deductible_type}
                          </Badge>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex flex-wrap gap-1">
                            {cat.applicable_forms.map(f => (
                              <span key={f} className="font-mono text-label badge-neutral">{f}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
