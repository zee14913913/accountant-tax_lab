import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateIssueSchema = z.object({
  entity_id:      z.string().min(1),
  issue_type:     z.enum(['MISSING_DOCUMENT', 'UNCLASSIFIED_TRANSACTION', 'RECONCILIATION_DIFFERENCE', 'TAX_SENSITIVE_ITEM', 'DIRECTOR_RELATED_TRANSACTION', 'RELATED_PARTY_TRANSACTION', 'HIGH_VALUE_TRANSACTION', 'DATA_INCONSISTENCY', 'OTHER']),
  title:          z.string().min(1),
  description:    z.string().optional(),
  related_txn_id: z.string().optional(),
  related_doc_id: z.string().optional(),
  period:         z.string().optional(),
  priority:       z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  assigned_to:    z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entity_id = searchParams.get('entity_id')
  const status    = searchParams.get('status')
  const priority  = searchParams.get('priority')
  const period    = searchParams.get('period')

  const where: Record<string, unknown> = {}
  if (entity_id) where.entity_id = entity_id
  if (status)    where.status = status
  if (priority)  where.priority = priority
  if (period)    where.period = period

  const issues = await prisma.unresolvedIssue.findMany({
    where,
    include: {
      entity: { select: { entity_name: true, flow_type: true } },
    },
    orderBy: [
      { priority: 'asc' },
      { created_at: 'desc' },
    ],
    take: 200,
  })

  return NextResponse.json({ data: issues, total: issues.length })
}

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreateIssueSchema.parse(body)

    const issue = await prisma.unresolvedIssue.create({ data: validated as any })

    await writeAuditLog({
      table_name: 'unresolved_issues',
      record_id:  issue.id,
      action:     'CREATE',
      after_json: issue,
      actor_id:   'system',
    })

    return NextResponse.json({ data: issue }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
