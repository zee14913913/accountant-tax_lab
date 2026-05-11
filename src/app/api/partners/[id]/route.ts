import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdatePartnerSchema = z.object({
  partner_name:            z.string().min(1).optional(),
  identification_no:       z.string().optional(),
  tax_no:                  z.string().optional(),
  profit_share_percentage: z.number().min(0).max(100).optional(),
  capital_contribution:    z.number().optional(),
  notes:                   z.string().optional(),
  is_active:               z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body      = await request.json()
    const validated = UpdatePartnerSchema.parse(body)

    const before = await prisma.partner.findFirst({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

    const updated = await prisma.partner.update({ where: { id }, data: validated })

    await writeAuditLog({
      table_name:  'partners',
      record_id:   id,
      action:      'UPDATE',
      before_json: before,
      after_json:  updated,
      actor_id:    'system',
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[PATCH /api/partners/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const before = await prisma.partner.findFirst({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })

  // Partner model has no archived_at field — soft-delete via is_active flag
  const updated = await prisma.partner.update({
    where: { id },
    data: { is_active: false },
  })

  await writeAuditLog({
    table_name:  'partners',
    record_id:   id,
    action:      'ARCHIVE',
    before_json: before,
    after_json:  updated,
    actor_id:    'system',
  })

  return NextResponse.json({ data: { archived: true } })
}
