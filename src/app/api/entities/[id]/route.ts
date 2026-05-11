import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateEntitySchema = z.object({
  entity_name:         z.string().min(1).optional(),
  entity_type:         z.enum(['INDIVIDUAL_TAX', 'SOLE_PROPRIETORSHIP', 'ENTERPRISE', 'PARTNERSHIP', 'SDN_BHD', 'BHD', 'LLP', 'FREELANCE']).optional(),
  flow_type:           z.enum(['INDIVIDUAL_ONLY', 'INDIVIDUAL_BUSINESS', 'PARTNERSHIP', 'COMPANY']).optional(),
  registration_no:     z.string().optional(),
  tax_reference_no:    z.string().optional(),
  sst_no:              z.string().optional(),
  e_invoice_phase:     z.enum(['PHASE_1', 'PHASE_2', 'PHASE_3', 'NOT_YET', 'VOLUNTARY', 'EXEMPT']).optional(),
  e_invoice_mandatory: z.boolean().optional(),
  financial_year_end:  z.string().optional(),
  reporting_framework: z.enum(['MFRS_FULL', 'MFRS_SME', 'CASH_BASIS', 'NONE']).optional(),
  base_currency:       z.string().optional(),
  is_active:           z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const entity = await prisma.entity.findFirst({
    where: { id, archived_at: null },
    include: {
      client:          { select: { id: true, legal_name: true, client_code: true } },
      filing_profiles: { where: { is_active: true } },
      bank_accounts:   { where: { is_active: true } },
      partners:        { where: { is_active: true } },
      _count:          { select: { transactions: true, import_batches: true } },
    },
  })

  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  return NextResponse.json({ data: entity })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body      = await request.json()
    const validated = UpdateEntitySchema.parse(body)

    const before = await prisma.entity.findFirst({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

    const updated = await prisma.entity.update({ where: { id }, data: validated })

    await writeAuditLog({
      table_name:  'entities',
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const before = await prisma.entity.findFirst({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const archived = await prisma.entity.update({
    where: { id },
    data: {
      archived_at: new Date(),
      archived_by: 'system',
      is_active:   false,
    },
  })

  await writeAuditLog({
    table_name:  'entities',
    record_id:   id,
    action:      'ARCHIVE',
    before_json: before,
    after_json:  archived,
    actor_id:    'system',
  })

  return NextResponse.json({ data: { archived: true } })
}
