// GET detail + PATCH update for a single MonthlyClose record
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const PatchSchema = z.object({
  status: z.enum(['DRAFT', 'IN_REVIEW', 'CLOSED', 'REOPENED', 'ARCHIVED']).optional(),
  checklist_json: z.any().optional(),
  notes: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const record = await prisma.monthlyClose.findUnique({
      where: { id: params.id },
      include: {
        entity: {
          select: {
            id: true,
            entity_name: true,
            flow_type: true,
            client: { select: { display_name: true, legal_name: true } },
          },
        },
        pnl_snapshots: {
          orderBy: { generated_at: 'desc' },
          take: 10,
        },
      },
    })
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ data: record })
  } catch (err) {
    console.error('[monthly-close/[id] GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.monthlyClose.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.monthlyClose.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.checklist_json && { checklist_json: parsed.data.checklist_json }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    })

    await writeAuditLog({
      table_name: 'monthly_close',
      record_id: updated.id,
      action: 'UPDATE',
      before_json: existing,
      after_json: updated,
      actor_id: 'system',
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[monthly-close/[id] PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
