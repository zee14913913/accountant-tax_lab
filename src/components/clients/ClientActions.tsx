'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Archive, RotateCcw } from 'lucide-react'

interface ClientActionsProps {
  clientId: string
  clientStatus: string
}

export function ClientActions({ clientId, clientStatus }: ClientActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleStatusToggle() {
    const newStatus = clientStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    if (!confirm(`Set client status to ${newStatus}?`)) return

    setLoading(true)
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleArchive() {
    if (!confirm('Archive this client? All entities will be preserved but the client will be hidden from active lists.')) return

    setLoading(true)
    try {
      await fetch(`/api/clients/${clientId}`, { method: 'DELETE' })
      router.push('/clients')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <p className="text-label font-medium text-ink-muted uppercase tracking-wide mb-3">Actions</p>
      <div className="space-y-2">
        <button
          onClick={handleStatusToggle}
          disabled={loading}
          className="btn-secondary w-full justify-start gap-2 text-label"
        >
          <RotateCcw size={14} />
          {clientStatus === 'ACTIVE' ? 'Set Inactive' : 'Set Active'}
        </button>
        <button
          onClick={handleArchive}
          disabled={loading}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-card text-label text-status-error hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
        >
          <Archive size={14} />
          Archive Client
        </button>
      </div>
    </Card>
  )
}
