export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Plus, Landmark } from 'lucide-react'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CURRENT:       'Current',
  SAVINGS:       'Savings',
  FIXED_DEPOSIT: 'Fixed Deposit',
  CREDIT_CARD:   'Credit Card',
  E_WALLET:      'e-Wallet',
  OTHER:         'Other',
}

function accountTypeVariant(type: string): 'success' | 'info' | 'warning' | 'neutral' {
  const map: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
    CURRENT:       'success',
    SAVINGS:       'info',
    FIXED_DEPOSIT: 'warning',
    CREDIT_CARD:   'warning',
    E_WALLET:      'neutral',
    OTHER:         'neutral',
  }
  return map[type] ?? 'neutral'
}

export default async function BankAccountsPage() {
  const accounts = await prisma.bankAccount.findMany({
    where: { archived_at: null },
    include: {
      entity: {
        select: {
          id: true,
          entity_name: true,
          flow_type: true,
          client: { select: { id: true, legal_name: true, display_name: true, client_code: true } },
        },
      },
      _count: { select: { transactions: true, import_batches: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  const stats = {
    total:  accounts.length,
    active: accounts.filter(a => a.is_active).length,
    byType: {
      CURRENT:       accounts.filter(a => a.account_type === 'CURRENT').length,
      SAVINGS:       accounts.filter(a => a.account_type === 'SAVINGS').length,
      FIXED_DEPOSIT: accounts.filter(a => a.account_type === 'FIXED_DEPOSIT').length,
      CREDIT_CARD:   accounts.filter(a => a.account_type === 'CREDIT_CARD').length,
    },
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Bank Accounts</h1>
          <p className="page-subtitle">{stats.total} accounts across {new Set(accounts.map(a => a.entity_id)).size} entities</p>
        </div>
        <Link href="/bank-accounts/new" className="btn-primary">
          <Plus size={16} />
          Add Account
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-5">
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Total</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.total}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Active</p>
          <p className="text-section font-bold text-status-success tabular-nums">{stats.active}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Current</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.byType.CURRENT}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Savings</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.byType.SAVINGS}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Credit Card</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.byType.CREDIT_CARD}</p>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-6">Bank</th>
              <th className="py-3 px-4">Account No</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Currency</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Txns</th>
              <th className="py-3 px-4 text-right">Imports</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16">
                  <Landmark size={32} className="text-ink-muted mx-auto mb-3" />
                  <p className="text-body text-ink-muted">No bank accounts yet.</p>
                  <p className="text-label text-ink-muted mt-1">Add a bank account to start importing statements.</p>
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id}>
                  <td className="py-3 px-6">
                    <p className="font-medium text-ink-primary">{account.bank_name}</p>
                    {account.account_name !== account.bank_name && (
                      <p className="text-label text-ink-muted">{account.account_name}</p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-body text-ink-primary">{account.account_no}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={accountTypeVariant(account.account_type)}>
                      {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-body text-ink-secondary">{account.entity.entity_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/clients/${account.entity.client.id}`} className="hover:underline">
                      <p className="text-body text-ink-secondary">{account.entity.client.display_name ?? account.entity.client.legal_name}</p>
                      <p className="text-label font-mono text-ink-muted">{account.entity.client.client_code}</p>
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-label text-ink-secondary">{account.currency}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={account.is_active ? 'success' : 'neutral'}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="tabular-nums text-body text-ink-secondary">
                      {account._count.transactions.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="tabular-nums text-body text-ink-secondary">
                      {account._count.import_batches}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/imports/new?bank_account_id=${account.id}`}
                      className="text-label text-ink-secondary hover:text-ink-primary whitespace-nowrap"
                    >
                      Import →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
