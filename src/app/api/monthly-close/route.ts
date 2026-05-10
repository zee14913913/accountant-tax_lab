import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateMonthlyCloseSchema = z.object({
  entity_id:    z.string().min(1),
  period_start: z.string(),
  period_end:   z.string(),
  notes:        z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entity_id = searchParams.get('entity_id')
  const status    = searchParams.get('status')

  const where: Record<string, unknown> = { archived_at: null }
  if (entity_id) where.entity_id = entity_id
  if (status)    where.status = status

  const limit  = parseInt(searchParams.get('limit') ?? '20')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const [closes, total] = await Promise.all([
    prisma.monthlyClose.findMany({
      where,
      include: {
        entity: {
          select: {
            entity_name: true,
            flow_type: true,
            client: { select: { display_name: true, legal_name: true } },
          },
        },
        pnl_snapshots: { orderBy: { generated_at: 'desc' }, take: 1 },
      },
      orderBy: { period_start: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.monthlyClose.count({ where }),
  ])

  return NextResponse.json({ data: closes, meta: { total, limit, offset } })
}

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreateMonthlyCloseSchema.parse(body)

    const entity = await prisma.entity.findFirst({ where: { id: validated.entity_id, archived_at: null } })
    if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

    // INDIVIDUAL_ONLY doesn't need monthly close
    if (entity.flow_type === 'INDIVIDUAL_ONLY') {
      return NextResponse.json({ error: 'Monthly close is not applicable for INDIVIDUAL_ONLY entities.' }, { status: 400 })
    }

    // Get checklist template for this flow_type
    const template = await prisma.checklistTemplate.findFirst({
      where: { flow_type: entity.flow_type, phase: 'MONTHLY_CLOSE', is_active: true },
    })

    const checklistJson = {
      flow_type: entity.flow_type,
      items: template
        ? (template.items_json as Array<{ key: string; label: string; required: boolean }>).map(item => ({
            ...item,
            status: 'PENDING',
          }))
        : [],
    }

    const monthlyClose = await prisma.monthlyClose.create({
      data: {
        entity_id:     validated.entity_id,
        period_start:  new Date(validated.period_start),
        period_end:    new Date(validated.period_end),
        status:        'DRAFT',
        checklist_json: checklistJson,
        notes:         validated.notes,
      },
    })

    await writeAuditLog({
      table_name: 'monthly_close',
      record_id:  monthlyClose.id,
      action:     'CREATE',
      after_json: { entity_id: validated.entity_id, period_start: validated.period_start },
      actor_id:   'system',
    })

    return NextResponse.json({ data: monthlyClose }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
