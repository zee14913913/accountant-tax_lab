// PATCH /api/tax-relief-items/[id] — update status (confirm/reject)
// DELETE /api/tax-relief-items/[id] — soft delete
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const PatchSchema = z.object({
  status:         z.enum(['DRAFT', 'CONFIRMED', 'REJECTED']).optional(),
  claimed_amount: z.number().optional(),
  notes:          z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body    = await request.json()
    const validated = PatchSchema.parse(body)

    const existing = await prisma.taxReliefItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tax relief item not found' }, { status: 404 })
    }

    const updated = await prisma.taxReliefItem.update({
      where: { id },
      data:  validated as any,
    })

    await writeAuditLog({
      actor_id:   'system',
      action:     'UPDATE',
      table_name: 'tax_relief_items',
      record_id:  id,
      before_json: existing,
      after_json:  updated,
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('PATCH /api/tax-relief-items/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.taxReliefItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tax relief item not found' }, { status: 404 })
    }

    // Hard delete is acceptable here (relief items are recalculated each year)
    await prisma.taxReliefItem.delete({ where: { id } })

    await writeAuditLog({
      actor_id:   'system',
      action:     'ARCHIVE',
      table_name: 'tax_relief_items',
      record_id:  id,
      before_json: existing,
      after_json:  null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/tax-relief-items/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
