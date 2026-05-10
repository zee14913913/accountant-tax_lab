import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateDocumentSchema = z.object({
  entity_id:       z.string().min(1),
  transaction_id:  z.string().optional(),
  document_scope:  z.enum(['TRANSACTION_LEVEL', 'ENTITY_LEVEL', 'PERIOD_LEVEL']),
  document_type:   z.enum([
    'INVOICE_ISSUED', 'INVOICE_RECEIVED', 'RECEIPT', 'BANK_STATEMENT',
    'CONTRACT', 'PAYROLL_RECORD', 'SSM_CERTIFICATE', 'TAX_CLEARANCE',
    'AUDIT_REPORT', 'FIXED_ASSET_PURCHASE', 'RELIEF_DOCUMENT', 'EA_FORM',
    'DIVIDEND_VOUCHER', 'PROFIT_SHARING_AGREEMENT', 'DIRECTOR_RESOLUTION', 'OTHER',
  ]),
  file_name:       z.string().min(1),
  file_url:        z.string().url(),
  file_size_bytes: z.number().int().optional(),
  period:          z.string().optional(),
  uploaded_by:     z.string().default('system'),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entity_id      = searchParams.get('entity_id')
  const transaction_id = searchParams.get('transaction_id')
  const document_scope = searchParams.get('document_scope')
  const document_type  = searchParams.get('document_type')
  const ocr_status     = searchParams.get('ocr_status')
  const verification   = searchParams.get('verification_status')
  const period         = searchParams.get('period')
  const page           = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize       = parseInt(searchParams.get('pageSize') ?? '50', 10)

  const where: Record<string, unknown> = { archived_at: null }
  if (entity_id)      where.entity_id = entity_id
  if (transaction_id) where.transaction_id = transaction_id
  if (document_scope) where.document_scope = document_scope
  if (document_type)  where.document_type = document_type
  if (ocr_status)     where.ocr_status = ocr_status
  if (verification)   where.verification_status = verification
  if (period)         where.period = period

  const [docs, total] = await Promise.all([
    prisma.supportingDocument.findMany({
      where,
      include: {
        entity:      { select: { entity_name: true, flow_type: true } },
        transaction: { select: { id: true, txn_date: true, description: true, amount: true, direction: true } },
      },
      orderBy: { uploaded_at: 'desc' },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.supportingDocument.count({ where }),
  ])

  return NextResponse.json({ data: docs, total, page, pageSize })
}

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreateDocumentSchema.parse(body)

    // Validate transaction belongs to entity if provided
    if (validated.transaction_id) {
      const txn = await prisma.transaction.findFirst({
        where: { id: validated.transaction_id, entity_id: validated.entity_id },
      })
      if (!txn) return NextResponse.json({ error: 'Transaction not found or does not belong to entity' }, { status: 400 })
    }

    const doc = await prisma.supportingDocument.create({
      data: {
        ...validated,
        ocr_status:          'PENDING',
        verification_status: 'UNVERIFIED',
      },
    })

    // Auto-update transaction document_status if bound to transaction
    if (validated.transaction_id) {
      await prisma.transaction.update({
        where: { id: validated.transaction_id },
        data:  { document_status: 'UPLOADED' },
      })
    }

    await writeAuditLog({
      table_name: 'supporting_documents',
      record_id:  doc.id,
      action:     'CREATE',
      after_json: doc,
      actor_id:   validated.uploaded_by,
    })

    return NextResponse.json({ data: doc }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[POST /api/documents]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
