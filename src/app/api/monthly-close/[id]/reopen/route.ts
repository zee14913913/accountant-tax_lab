// POST /api/monthly-close/[id]/reopen — Reopen a CLOSED period
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const ReopenSchema = z.object({
  actor_id: z.string(),
  reason: z.string().min(1, 'Reason is required when reopening a closed period'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json()
    const parsed = ReopenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.monthlyClose.findUnique({ where: { id: (await params).id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (existing.status !== 'CLOSED') {
      return NextResponse.json(
        { error: `Cannot reopen a period with status "${existing.status}". Only CLOSED periods can be reopened.` },
        { status: 400 }
      )
    }

    const updated = await prisma.monthlyClose.update({
      where: { id: (await params).id },
      data: {
        status: 'REOPENED',
        reopened_by: parsed.data.actor_id,
        reopened_at: new Date(),
        notes: existing.notes
          ? `${existing.notes}\n[REOPENED ${new Date().toISOString()}]: ${parsed.data.reason}`
          : `[REOPENED ${new Date().toISOString()}]: ${parsed.data.reason}`,
      },
    })

    await writeAuditLog({
      table_name: 'monthly_close',
      record_id: updated.id,
      action: 'REOPEN',
      before_json: existing,
      after_json: updated,
      actor_id: parsed.data.actor_id,
    })

    return NextResponse.json({
      data: updated,
      message: 'Period reopened successfully. Transactions in this period are now editable.',
    })
  } catch (err) {
    console.error('[monthly-close/[id]/reopen POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
