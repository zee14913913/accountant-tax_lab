import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateTransactionSchema = z.object({
  accounting_category_id: z.string().nullable().optional(),
  tax_category_id:        z.string().nullable().optional(),
  counterparty_id:        z.string().nullable().optional(),
  review_status:          z.enum(['UNREVIEWED', 'IN_REVIEW', 'REVIEWED', 'FLAGGED', 'APPROVED']).optional(),
  document_status:        z.enum(['NOT_REQUIRED', 'REQUIRED_MISSING', 'UPLOADED', 'VERIFIED']).optional(),
  reconciliation_status:  z.enum(['UNMATCHED', 'MATCHED', 'PARTIAL', 'EXCEPTION']).optional(),
  risk_flag:              z.enum(['ROUND_NUMBER', 'HIGH_VALUE', 'RELATED_PARTY', 'UNUSUAL_COUNTERPARTY', 'DUPLICATE_SUSPECT', 'MISSING_DOCS', 'TAX_SENSITIVE', 'DIRECTOR_RELATED']).nullable().optional(),
  management_note:        z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const txn = await prisma.transaction.findFirst({
    where: { id: (await params).id, archived_at: null },
    include: {
      accounting_category: true,
      tax_category:        true,
      counterparty:        true,
      import_batch:        { select: { id: true, statement_month: true, source_file_name: true, bank_account: { select: { bank_name: true, account_no: true } } } },
      entity:              { select: { id: true, entity_name: true, flow_type: true } },
      bank_account:        { select: { id: true, bank_name: true, account_name: true, account_no: true } },
    },
  })

  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  return NextResponse.json({ data: txn })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body      = await request.json()
    const validated = UpdateTransactionSchema.parse(body)

    const before = await prisma.transaction.findFirst({ where: { id: (await params).id } })
    if (!before) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const updated = await prisma.transaction.update({
      where: { id: (await params).id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data:  validated as any,
    })

    await writeAuditLog({
      table_name:  'transactions',
      record_id:   (await params).id,
      action:      'UPDATE',
      before_json: {
        accounting_category_id: before.accounting_category_id,
        tax_category_id:        before.tax_category_id,
        review_status:          before.review_status,
        document_status:        before.document_status,
        risk_flag:              before.risk_flag,
      },
      after_json: validated,
      actor_id:   'system',
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Soft archive — transactions are NOT hard deleted
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const before = await prisma.transaction.findFirst({ where: { id: (await params).id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only allow archiving manual transactions
  if (!before.is_manual) {
    return NextResponse.json({
      error: 'Cannot archive imported transactions directly. Archive the import batch instead.',
    }, { status: 400 })
  }

  const archived = await prisma.transaction.update({
    where: { id: (await params).id },
    data:  { archived_at: new Date(), archived_by: 'system' },
  })

  await writeAuditLog({
    table_name:  'transactions',
    record_id:   (await params).id,
    action:      'ARCHIVE',
    before_json: before,
    after_json:  archived,
    actor_id:    'system',
  })

  return NextResponse.json({ data: { archived: true } })
}
