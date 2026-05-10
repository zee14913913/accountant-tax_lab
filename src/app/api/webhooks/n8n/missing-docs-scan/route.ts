/**
 * POST /api/webhooks/n8n/missing-docs-scan
 *
 * Called by n8n daily schedule trigger.
 * Scans APPROVED/REVIEWED transactions that have document_status = REQUIRED_MISSING,
 * aggregates by entity, creates/updates UnresolvedIssue records.
 *
 * Note: UnresolvedIssue model is added in Phase 5 schema.
 * This endpoint is prepared here but will be fully active after Phase 5 migration.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const expectedSecret = process.env.N8N_WEBHOOK_SECRET ?? ''
    if (expectedSecret && body.secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find all REQUIRED_MISSING transactions (not archived)
    const missingDocTxns = await prisma.transaction.findMany({
      where: {
        archived_at:     null,
        document_status: 'REQUIRED_MISSING',
        review_status:   { in: ['REVIEWED', 'APPROVED', 'FLAGGED'] },
      },
      select: {
        id: true, entity_id: true, txn_date: true,
        description: true, amount: true, direction: true,
      },
    })

    // Aggregate by entity
    const byEntity: Record<string, typeof missingDocTxns> = {}
    for (const txn of missingDocTxns) {
      if (!byEntity[txn.entity_id]) byEntity[txn.entity_id] = []
      byEntity[txn.entity_id].push(txn)
    }

    const result = {
      entities_affected:    Object.keys(byEntity).length,
      total_missing:        missingDocTxns.length,
      breakdown_by_entity:  Object.entries(byEntity).map(([entity_id, txns]) => ({
        entity_id,
        missing_count: txns.length,
      })),
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[webhook/missing-docs-scan]', err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
