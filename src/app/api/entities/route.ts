import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateEntitySchema = z.object({
  client_id:            z.string(),
  entity_name:          z.string().min(1),
  entity_type:          z.enum(['INDIVIDUAL_TAX', 'SOLE_PROPRIETORSHIP', 'ENTERPRISE', 'PARTNERSHIP', 'SDN_BHD', 'BHD', 'LLP', 'FREELANCE']),
  flow_type:            z.enum(['INDIVIDUAL_ONLY', 'INDIVIDUAL_BUSINESS', 'PARTNERSHIP', 'COMPANY']),
  registration_no:      z.string().optional(),
  tax_reference_no:     z.string().optional(),
  sst_no:               z.string().optional(),
  e_invoice_phase:      z.enum(['PHASE_1', 'PHASE_2', 'PHASE_3', 'NOT_YET', 'VOLUNTARY', 'EXEMPT']).optional(),
  e_invoice_mandatory:  z.boolean().optional(),
  financial_year_end:   z.string().default('12-31'),
  reporting_framework:  z.enum(['MFRS_FULL', 'MFRS_SME', 'CASH_BASIS', 'NONE']).optional(),
  base_currency:        z.string().default('MYR'),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const client_id  = searchParams.get('client_id')
  const flow_type  = searchParams.get('flow_type')
  const is_active  = searchParams.get('is_active')
  const limit      = parseInt(searchParams.get('limit') ?? '200')
  const offset     = parseInt(searchParams.get('offset') ?? '0')

  const where: Record<string, unknown> = { archived_at: null }
  if (client_id) where.client_id = client_id
  if (flow_type) where.flow_type = flow_type
  if (is_active === 'true') where.is_active = true
  if (is_active === 'false') where.is_active = false

  const [entities, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      include: {
        client: { select: { id: true, legal_name: true, display_name: true, client_code: true } },
        filing_profiles: { where: { is_active: true } },
        bank_accounts:   { where: { is_active: true } },
        partners:        { where: { is_active: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.entity.count({ where }),
  ])

  return NextResponse.json({ data: entities, meta: { total, limit, offset } })
}

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreateEntitySchema.parse(body)

    const entity = await prisma.entity.create({ data: validated })

    await writeAuditLog({
      table_name: 'entities',
      record_id:  entity.id,
      action:     'CREATE',
      after_json: entity,
      actor_id:   'system',
    })

    return NextResponse.json({ data: entity }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
