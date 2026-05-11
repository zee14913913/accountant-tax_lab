import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateCounterpartySchema = z.object({
  client_id:       z.string().min(1),
  type:            z.enum(['CUSTOMER', 'SUPPLIER', 'BANK', 'GOVERNMENT', 'DIRECTOR', 'SHAREHOLDER', 'EMPLOYEE', 'RELATED_PARTY', 'OTHER']),
  name:            z.string().min(1),
  registration_no: z.string().optional(),
  tax_no:          z.string().optional(),
  contact_json:    z.record(z.unknown()).optional(),
  notes:           z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const client_id = searchParams.get('client_id')
  const type      = searchParams.get('type')
  const search    = searchParams.get('search')

  const where: Record<string, unknown> = { is_active: true }
  if (client_id) where.client_id = client_id
  if (type)      where.type = type
  if (search)    where.name = { contains: search, mode: 'insensitive' }

  const counterparties = await prisma.counterparty.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 200,
  })

  return NextResponse.json({ data: counterparties, total: counterparties.length })
}

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreateCounterpartySchema.parse(body)

    const counterparty = await prisma.counterparty.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: validated as any,
    })

    await writeAuditLog({
      table_name: 'counterparties',
      record_id:  counterparty.id,
      action:     'CREATE',
      after_json: counterparty,
      actor_id:   'system',
    })

    return NextResponse.json({ data: counterparty }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
