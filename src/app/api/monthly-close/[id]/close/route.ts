/**
 * POST /api/monthly-close/[id]/close
 *
 * Executes the monthly close for a period.
 * Checks readiness before closing:
 * - No unclassified transactions in the period
 * - No REQUIRED_MISSING documents linked to REVIEWED/APPROVED transactions
 * - Updates status to CLOSED
 * - Updates checklist items to DONE where data supports it
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

interface ChecklistItem {
  key: string; label: string; required: boolean; status: string;
  completed_by?: string; completed_at?: string;
}

interface ChecklistJson {
  flow_type: string;
  items: ChecklistItem[];
}

const CloseSchema = z.object({
  closed_by:     z.string().default('system'),
  force:         z.boolean().default(false),  // Force close even with blockers
  notes:         z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body      = await request.json()
    const validated = CloseSchema.parse(body)

    const monthlyClose = await prisma.monthlyClose.findFirst({
      where:   { id: (await params).id, archived_at: null },
      include: { entity: { select: { id: true, flow_type: true } } },
    })

    if (!monthlyClose) return NextResponse.json({ error: 'Monthly close record not found' }, { status: 404 })

    if (monthlyClose.status === 'CLOSED') {
      return NextResponse.json({ error: 'This period is already closed.' }, { status: 409 })
    }

    // Run readiness check
    const [unclassified, missingDocs] = await Promise.all([
      prisma.transaction.count({
        where: {
          entity_id:              monthlyClose.entity?.id,
          archived_at:            null,
          accounting_category_id: null,
          txn_date: {
            gte: monthlyClose.period_start,
            lte: monthlyClose.period_end,
          },
        },
      }),
      prisma.transaction.count({
        where: {
          entity_id:       monthlyClose.entity?.id,
          archived_at:     null,
          document_status: 'REQUIRED_MISSING',
          review_status:   { in: ['REVIEWED', 'APPROVED'] },
          txn_date: {
            gte: monthlyClose.period_start,
            lte: monthlyClose.period_end,
          },
        },
      }),
    ])

    const blockers: string[] = []
    if (unclassified > 0) blockers.push(`${unclassified} unclassified transactions`)
    if (missingDocs > 0)  blockers.push(`${missingDocs} transactions with missing documents`)

    if (blockers.length > 0 && !validated.force) {
      return NextResponse.json({
        error:    'Cannot close: blockers found',
        blockers,
        tip:      'Resolve blockers first, or pass { force: true } to override.',
      }, { status: 400 })
    }

    // Auto-update checklist items based on actual state
    const checklist = monthlyClose.checklist_json as unknown as ChecklistJson
    const now = new Date().toISOString()
    const updatedItems = checklist.items.map((item: ChecklistItem) => {
      // Auto-complete certain items based on system state
      if (item.key === 'all_txns_classified' && unclassified === 0) {
        return { ...item, status: 'DONE', completed_by: 'system', completed_at: now }
      }
      if (item.key === 'missing_docs_resolved' && missingDocs === 0) {
        return { ...item, status: 'DONE', completed_by: 'system', completed_at: now }
      }
      return item
    })

    const updatedClose = await prisma.monthlyClose.update({
      where: { id: (await params).id },
      data: {
        status:         'CLOSED',
        closed_by:      validated.closed_by,
        closed_at:      new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        checklist_json: { ...checklist, items: updatedItems } as any,
        notes:          validated.notes ?? monthlyClose.notes,
      },
    })

    await writeAuditLog({
      table_name:  'monthly_close',
      record_id:   (await params).id,
      action:      'CLOSE',
      before_json: { status: monthlyClose.status },
      after_json:  { status: 'CLOSED', closed_by: validated.closed_by, blockers_at_close: blockers },
      actor_id:    validated.closed_by,
    })

    return NextResponse.json({
      data: updatedClose,
      warning: blockers.length > 0 && validated.force
        ? `Closed with ${blockers.length} unresolved blocker(s): ${blockers.join('; ')}`
        : null,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
