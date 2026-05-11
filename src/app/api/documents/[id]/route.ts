import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateDocumentSchema = z.object({
  document_type:       z.enum(['INVOICE_ISSUED', 'INVOICE_RECEIVED', 'RECEIPT', 'BANK_STATEMENT', 'CONTRACT', 'PAYROLL_RECORD', 'SSM_CERTIFICATE', 'TAX_CLEARANCE', 'AUDIT_REPORT', 'FIXED_ASSET_PURCHASE', 'RELIEF_DOCUMENT', 'EA_FORM', 'DIVIDEND_VOUCHER', 'PROFIT_SHARING_AGREEMENT', 'DIRECTOR_RESOLUTION', 'OTHER']).optional(),
  transaction_id:      z.string().nullable().optional(),
  verification_status: z.enum(['UNVERIFIED', 'VERIFIED', 'REJECTED', 'QUERIED']).optional(),
  period:              z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const doc = await prisma.supportingDocument.findFirst({
    where: { id: (await params).id, archived_at: null },
    include: {
      entity:      { select: { id: true, entity_name: true, flow_type: true } },
      transaction: { select: { id: true, txn_date: true, description: true, amount: true, direction: true, bank_account: { select: { bank_name: true } } } },
    },
  })

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  return NextResponse.json({ data: doc })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body      = await request.json()
    const validated = UpdateDocumentSchema.parse(body)

    const before = await prisma.supportingDocument.findFirst({ where: { id: (await params).id } })
    if (!before) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const updated = await prisma.supportingDocument.update({
      where: { id: (await params).id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data:  validated as any,
    })

    // If marked VERIFIED and bound to a transaction, update transaction document_status
    if (validated.verification_status === 'VERIFIED' && updated.transaction_id) {
      await prisma.transaction.update({
        where: { id: updated.transaction_id },
        data:  { document_status: 'VERIFIED' },
      })
    }

    await writeAuditLog({
      table_name:  'supporting_documents',
      record_id:   (await params).id,
      action:      'UPDATE',
      before_json: { verification_status: before.verification_status, document_type: before.document_type },
      after_json:  validated,
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

// Soft archive
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const before = await prisma.supportingDocument.findFirst({ where: { id: (await params).id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const archived = await prisma.supportingDocument.update({
    where: { id: (await params).id },
    data:  { archived_at: new Date() },
  })

  // Revert transaction document_status if was the only doc
  if (before.transaction_id) {
    const remainingDocs = await prisma.supportingDocument.count({
      where: { transaction_id: before.transaction_id, archived_at: null },
    })
    if (remainingDocs === 0) {
      await prisma.transaction.update({
        where: { id: before.transaction_id },
        data:  { document_status: 'REQUIRED_MISSING' },
      })
    }
  }

  await writeAuditLog({
    table_name: 'supporting_documents',
    record_id:  (await params).id,
    action:     'ARCHIVE',
    before_json: before,
    after_json:  archived,
    actor_id:    'system',
  })

  return NextResponse.json({ data: { archived: true } })
}
