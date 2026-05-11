import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateImportBatchSchema = z.object({
  import_status:             z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'ARCHIVED']).optional(),
  source_transaction_count:  z.number().int().optional(),
  imported_transaction_count: z.number().int().optional(),
  unparsed_count:            z.number().int().optional(),
  parse_errors_json:         z.record(z.unknown()).optional(),
  notes:                     z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const batch = await prisma.importBatch.findFirst({
    where: { id: (await params).id, archived_at: null },
    include: {
      entity:       { select: { id: true, entity_name: true, flow_type: true, client: { select: { legal_name: true } } } },
      bank_account: { select: { id: true, bank_name: true, account_name: true, account_no: true } },
      transactions: {
        orderBy: { txn_date: 'desc' },
        take: 200,
        select: {
          id: true, txn_date: true, description: true, direction: true,
          amount: true, balance_after: true, review_status: true,
          document_status: true, accounting_category_id: true, risk_flag: true,
        },
      },
      _count: { select: { transactions: true } },
    },
  })

  if (!batch) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
  return NextResponse.json({ data: batch })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body      = await request.json()
    const validated = UpdateImportBatchSchema.parse(body)

    const before = await prisma.importBatch.findFirst({ where: { id: (await params).id } })
    if (!before) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })

    const updated = await prisma.importBatch.update({
      where: { id: (await params).id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data:  validated as any,
    })

    await writeAuditLog({
      table_name:  'import_batches',
      record_id:   (await params).id,
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

// Archive (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const before = await prisma.importBatch.findFirst({ where: { id: (await params).id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const archived = await prisma.importBatch.update({
    where: { id: (await params).id },
    data: { archived_at: new Date(), import_status: 'ARCHIVED' },
  })

  await writeAuditLog({
    table_name:  'import_batches',
    record_id:   (await params).id,
    action:      'ARCHIVE',
    before_json: before,
    after_json:  archived,
    actor_id:    'system',
  })

  return NextResponse.json({ data: { archived: true } })
}
