/**
 * POST /api/transactions/bulk
 *
 * Batch operations on multiple transactions.
 * Supports: bulk classify, bulk mark document_status, bulk flag, bulk approve.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const BulkOperationSchema = z.object({
  transaction_ids: z.array(z.string()).min(1).max(200),
  operation:       z.enum(['CLASSIFY', 'SET_DOCUMENT_STATUS', 'SET_REVIEW_STATUS', 'SET_RISK_FLAG', 'CLEAR_RISK_FLAG']),
  // Fields for CLASSIFY
  accounting_category_id: z.string().nullable().optional(),
  tax_category_id:        z.string().nullable().optional(),
  counterparty_id:        z.string().nullable().optional(),
  // Field for SET_DOCUMENT_STATUS
  document_status: z.enum(['NOT_REQUIRED', 'REQUIRED_MISSING', 'UPLOADED', 'VERIFIED']).optional(),
  // Field for SET_REVIEW_STATUS
  review_status:   z.enum(['UNREVIEWED', 'IN_REVIEW', 'REVIEWED', 'FLAGGED', 'APPROVED']).optional(),
  // Field for SET_RISK_FLAG
  risk_flag: z.enum(['ROUND_NUMBER', 'HIGH_VALUE', 'RELATED_PARTY', 'UNUSUAL_COUNTERPARTY', 'DUPLICATE_SUSPECT', 'MISSING_DOCS', 'TAX_SENSITIVE', 'DIRECTOR_RELATED']).nullable().optional(),
  actor_id:  z.string().default('system'),
})

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = BulkOperationSchema.parse(body)

    const { transaction_ids, operation, actor_id, ...fields } = validated

    let updateData: Record<string, unknown> = {}

    switch (operation) {
      case 'CLASSIFY':
        if (fields.accounting_category_id !== undefined) updateData.accounting_category_id = fields.accounting_category_id
        if (fields.tax_category_id !== undefined)        updateData.tax_category_id        = fields.tax_category_id
        if (fields.counterparty_id !== undefined)        updateData.counterparty_id        = fields.counterparty_id
        break

      case 'SET_DOCUMENT_STATUS':
        if (!fields.document_status) return NextResponse.json({ error: 'document_status required' }, { status: 400 })
        updateData = { document_status: fields.document_status }
        break

      case 'SET_REVIEW_STATUS':
        if (!fields.review_status) return NextResponse.json({ error: 'review_status required' }, { status: 400 })
        updateData = { review_status: fields.review_status }
        break

      case 'SET_RISK_FLAG':
        updateData = { risk_flag: fields.risk_flag ?? null }
        break

      case 'CLEAR_RISK_FLAG':
        updateData = { risk_flag: null }
        break
    }

    const result = await prisma.transaction.updateMany({
      where: {
        id:          { in: transaction_ids },
        archived_at: null,
      },
      data: updateData,
    })

    // Single bulk audit log entry
    await writeAuditLog({
      table_name:  'transactions',
      record_id:   `bulk:${transaction_ids.length}`,
      action:      'UPDATE',
      before_json: null,
      after_json:  { operation, transaction_ids, updateData },
      actor_id,
    })

    return NextResponse.json({
      data: {
        operation,
        affected:  result.count,
        requested: transaction_ids.length,
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
