'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'

export function AddEntityButton({ clientId }: { clientId: string }) {
  return (
    <Link
      href={`/entities/new?client_id=${clientId}`}
      className="btn-primary text-label"
    >
      <Plus size={14} />
      Add Entity
    </Link>
  )
}
