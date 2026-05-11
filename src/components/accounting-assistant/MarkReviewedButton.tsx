'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MarkReviewedButtonProps {
  transactionId: string
}

export function MarkReviewedButton({ transactionId }: MarkReviewedButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: 'REVIEWED' }),
      })
      if (res.ok) {
        setDone(true)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <span
        style={{
          fontSize: '12px',
          color: '#5E5E5E',
          fontFamily: "'Avenir Next', system-ui, sans-serif",
        }}
      >
        Reviewed
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        fontSize: '12px',
        fontWeight: 500,
        color: '#111111',
        background: 'transparent',
        border: '1px solid #DDDDDA',
        borderRadius: '4px',
        padding: '4px 10px',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.5 : 1,
        fontFamily: "'Avenir Next', system-ui, sans-serif",
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? 'Saving…' : 'Mark Reviewed'}
    </button>
  )
}
