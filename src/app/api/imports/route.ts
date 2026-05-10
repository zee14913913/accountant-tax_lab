import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateImportBatchSchema = z.object({
  entity_id:       z.string().min(1),
  bank_account_id: z.string().min(1),
  source_file_name: z.string().min(1),
  source_file_url:  z.string().url(),
  source_type:      z.enum(['PDF_STATEMENT', 'CSV_EXPORT', 'EXCEL_EXPORT', 'MANUAL_ENTRY', 'API_SYNC']),
  statement_month:  z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
  notes:            z.string().optional(),
  imported_by:      z.string().default('system'),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entity_id      = searchParams.get('entity_id')
  const bank_account_id = searchParams.get('bank_account_id')
  const status         = searchParams.get('status')
  const month          = searchParams.get('month')
  const page           = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize       = parseInt(searchParams.get('pageSize') ?? '50', 10)

  const where: Record<string, unknown> = { archived_at: null }
  if (entity_id)       where.entity_id = entity_id
  if (bank_account_id) where.bank_account_id = bank_account_id
  if (status)          where.import_status = status
  if (month)           where.statement_month = month

  const [batches, total] = await Promise.all([
    prisma.importBatch.findMany({
      where,
      include: {
        entity:       { select: { id: true, entity_name: true, flow_type: true } },
        bank_account: { select: { id: true, bank_name: true, account_no: true } },
        _count:       { select: { transactions: true } },
      },
      orderBy: { imported_at: 'desc' },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.importBatch.count({ where }),
  ])

  return NextResponse.json({ data: batches, total, page, pageSize })
}

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreateImportBatchSchema.parse(body)

    // Verify entity and bank account exist
    const [entity, bankAccount] = await Promise.all([
      prisma.entity.findFirst({ where: { id: validated.entity_id, archived_at: null } }),
      prisma.bankAccount.findFirst({ where: { id: validated.bank_account_id, entity_id: validated.entity_id } }),
    ])

    if (!entity)      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    if (!bankAccount) return NextResponse.json({ error: 'Bank account not found or does not belong to entity' }, { status: 400 })

    const batch = await prisma.importBatch.create({
      data: {
        ...validated,
        import_status: 'PENDING',
      },
    })

    await writeAuditLog({
      table_name: 'import_batches',
      record_id:  batch.id,
      action:     'IMPORT',
      after_json: batch,
      actor_id:   validated.imported_by,
    })

    return NextResponse.json({ data: batch }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[POST /api/imports]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
