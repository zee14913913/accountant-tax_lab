import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { generateClientCode } from '@/lib/utils'

const CreateClientSchema = z.object({
  legal_name:        z.string().min(1),
  display_name:      z.string().optional(),
  client_type:       z.enum(['INDIVIDUAL', 'BUSINESS_OWNER', 'PARTNER', 'DIRECTOR']),
  primary_flow_type: z.enum(['INDIVIDUAL_ONLY', 'INDIVIDUAL_BUSINESS', 'PARTNERSHIP', 'COMPANY']),
  registration_no:   z.string().optional(),
  identification_no: z.string().optional(),
  tax_no:            z.string().optional(),
  phone:             z.string().optional(),
  email:             z.string().email().optional(),
  assigned_owner_id: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status    = searchParams.get('status')
  const flow_type = searchParams.get('flow_type')
  const page      = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize  = parseInt(searchParams.get('pageSize') ?? '50', 10)

  const where: Record<string, unknown> = { archived_at: null }
  if (status)    where.status = status
  if (flow_type) where.primary_flow_type = flow_type

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        entities:       { where: { archived_at: null }, select: { id: true, entity_name: true, entity_type: true } },
        assigned_owner: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
    prisma.client.count({ where }),
  ])

  return NextResponse.json({ data: clients, total, page, pageSize })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = CreateClientSchema.parse(body)

    const client = await prisma.client.create({
      data: {
        ...validated,
        client_code: generateClientCode('CLT'),
        status: 'ACTIVE',
      },
    })

    // Audit log
    await writeAuditLog({
      table_name: 'clients',
      record_id:  client.id,
      action:     'CREATE',
      after_json: client,
      actor_id:   validated.assigned_owner_id ?? 'system',
    })

    return NextResponse.json({ data: client }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[POST /api/clients]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
