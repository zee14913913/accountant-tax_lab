import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateManualTransactionSchema = z.object({
  entity_id:       z.string().min(1),
  bank_account_id: z.string().min(1),
  txn_date:        z.string(),
  description:     z.string().min(1),
  direction:       z.enum(['CREDIT', 'DEBIT']),
  amount:          z.number().positive(),
  balance_after:   z.number().optional(),
  reference_no:    z.string().optional(),
  accounting_category_id: z.string().optional(),
  tax_category_id:        z.string().optional(),
  management_note:        z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entity_id              = searchParams.get('entity_id')
  const bank_account_id        = searchParams.get('bank_account_id')
  const import_batch_id        = searchParams.get('import_batch_id')
  const review_status          = searchParams.get('review_status')
  const document_status        = searchParams.get('document_status')
  const risk_flag              = searchParams.get('risk_flag')
  const direction              = searchParams.get('direction')
  const unclassified_only      = searchParams.get('unclassified_only') === 'true'
  const month                  = searchParams.get('month')   // YYYY-MM
  const page                   = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize               = parseInt(searchParams.get('pageSize') ?? '100', 10)

  const where: Record<string, unknown> = { archived_at: null }
  if (entity_id)          where.entity_id = entity_id
  if (bank_account_id)    where.bank_account_id = bank_account_id
  if (import_batch_id)    where.import_batch_id = import_batch_id
  if (review_status)      where.review_status = review_status
  if (document_status)    where.document_status = document_status
  if (risk_flag)          where.risk_flag = risk_flag
  if (direction)          where.direction = direction
  if (unclassified_only)  where.accounting_category_id = null

  if (month) {
    const [year, mo] = month.split('-').map(Number)
    where.txn_date = {
      gte: new Date(year, mo - 1, 1),
      lt:  new Date(year, mo, 1),
    }
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        accounting_category: { select: { id: true, code: true, name: true, report_group: true } },
        tax_category:        { select: { id: true, code: true, name: true, deductible_type: true } },
        counterparty:        { select: { id: true, name: true, type: true } },
        import_batch:        { select: { id: true, statement_month: true, source_file_name: true } },
      },
      orderBy: [{ txn_date: 'desc' }, { created_at: 'desc' }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({ data: transactions, total, page, pageSize })
}

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreateManualTransactionSchema.parse(body)

    const txn = await prisma.transaction.create({
      data: {
        ...validated,
        txn_date:   new Date(validated.txn_date),
        is_manual:  true,
        review_status:        'UNREVIEWED',
        document_status:      'NOT_REQUIRED',
        reconciliation_status: 'UNMATCHED',
      },
    })

    await writeAuditLog({
      table_name: 'transactions',
      record_id:  txn.id,
      action:     'CREATE',
      after_json: { ...txn, is_manual: true },
      actor_id:   'system',
    })

    return NextResponse.json({ data: txn }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[POST /api/transactions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
