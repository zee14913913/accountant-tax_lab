/**
 * POST /api/transactions/[id]/classify
 *
 * Dedicated classification endpoint for the transaction workbench.
 * Applies accounting_category, tax_category, counterparty,
 * document_status, and review_status in one operation.
 * Writes a targeted audit log entry.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const ClassifySchema = z.object({
  accounting_category_id: z.string().nullable().optional(),
  tax_category_id:        z.string().nullable().optional(),
  counterparty_id:        z.string().nullable().optional(),
  document_status:        z.enum(['NOT_REQUIRED', 'REQUIRED_MISSING', 'UPLOADED', 'VERIFIED']).optional(),
  review_status:          z.enum(['UNREVIEWED', 'IN_REVIEW', 'REVIEWED', 'FLAGGED', 'APPROVED']).optional(),
  risk_flag:              z.enum(['ROUND_NUMBER', 'HIGH_VALUE', 'RELATED_PARTY', 'UNUSUAL_COUNTERPARTY', 'DUPLICATE_SUSPECT', 'MISSING_DOCS', 'TAX_SENSITIVE', 'DIRECTOR_RELATED']).nullable().optional(),
  management_note:        z.string().optional(),
  actor_id:               z.string().default('system'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body      = await request.json()
    const validated = ClassifySchema.parse(body)

    const { actor_id, ...updateData } = validated

    const before = await prisma.transaction.findFirst({
      where: { id: params.id, archived_at: null },
      select: {
        id: true,
        accounting_category_id: true,
        tax_category_id:        true,
        counterparty_id:        true,
        document_status:        true,
        review_status:          true,
        risk_flag:              true,
        management_note:        true,
      },
    })

    if (!before) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data:  updateData,
      include: {
        accounting_category: { select: { id: true, code: true, name: true, report_group: true } },
        tax_category:        { select: { id: true, code: true, name: true, deductible_type: true } },
        counterparty:        { select: { id: true, name: true, type: true } },
      },
    })

    await writeAuditLog({
      table_name:  'transactions',
      record_id:   params.id,
      action:      'REVIEW_APPROVE',
      before_json: before,
      after_json:  {
        accounting_category_id: updated.accounting_category_id,
        tax_category_id:        updated.tax_category_id,
        counterparty_id:        updated.counterparty_id,
        document_status:        updated.document_status,
        review_status:          updated.review_status,
        risk_flag:              updated.risk_flag,
      },
      actor_id,
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
