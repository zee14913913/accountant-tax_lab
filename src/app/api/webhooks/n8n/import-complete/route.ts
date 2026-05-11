/**
 * POST /api/webhooks/n8n/import-complete
 *
 * Callback endpoint that n8n calls after parsing is done.
 * Receives parsed transactions, bulk-inserts them, updates import_batch status.
 * Performs source_hash deduplication to avoid double-importing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

interface ParsedTransaction {
  txn_date:     string   // ISO date string
  posting_date?: string
  description:  string
  raw_text?:    string
  reference_no?: string
  direction:    'CREDIT' | 'DEBIT'
  amount:       number
  balance_after?: number
  source_hash?: string
}

interface ImportCompletePayload {
  secret:           string
  import_batch_id:  string
  status:           'COMPLETED' | 'PARTIAL' | 'FAILED'
  transactions:     ParsedTransaction[]
  unparsed_count?:  number
  parse_errors?:    unknown[]
  source_transaction_count?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportCompletePayload = await request.json()

    // Validate webhook secret
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET ?? ''
    if (expectedSecret && body.secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: body.import_batch_id },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })
    }

    let inserted = 0
    let skipped  = 0

    if (body.status !== 'FAILED' && body.transactions?.length > 0) {
      // Deduplicate by source_hash
      const existingHashes = body.transactions
        .filter(t => t.source_hash)
        .map(t => t.source_hash as string)

      const existingRecords = existingHashes.length > 0
        ? await prisma.transaction.findMany({
            where: { source_hash: { in: existingHashes }, entity_id: batch.entity_id },
            select: { source_hash: true },
          })
        : []

      const existingHashSet = new Set(existingRecords.map(r => r.source_hash))

      const toInsert = body.transactions.filter(t => {
        if (!t.source_hash) return true // No hash = always insert
        if (existingHashSet.has(t.source_hash)) { skipped++; return false }
        return true
      })

      if (toInsert.length > 0) {
        // Auto-detect risk flags based on amount and description
        const txnData = toInsert.map(t => {
          const amount = Math.abs(t.amount)
          let risk_flag = null

          // Round number detection (>= RM500, ends in 000)
          if (amount >= 500 && amount % 1000 === 0) risk_flag = 'ROUND_NUMBER'
          // High value detection (>= RM10,000)
          if (amount >= 10000) risk_flag = 'HIGH_VALUE'

          // Director keyword detection
          const desc = (t.description ?? '').toUpperCase()
          if (desc.includes('DIRECTOR') || desc.includes('DIR ') || desc.includes('SALARY DIR')) {
            risk_flag = 'DIRECTOR_RELATED'
          }
          // Related party keywords
          if (desc.includes('RELATED') || desc.includes('SHAREHOLDER') || desc.includes('SHD ')) {
            risk_flag = 'RELATED_PARTY'
          }

          return {
            entity_id:       batch.entity_id,
            bank_account_id: batch.bank_account_id,
            import_batch_id: batch.id,
            txn_date:        new Date(t.txn_date),
            posting_date:    t.posting_date ? new Date(t.posting_date) : null,
            description:     t.description,
            raw_text:        t.raw_text ?? null,
            reference_no:    t.reference_no ?? null,
            direction:       t.direction,
            amount:          Math.abs(t.amount),
            balance_after:   t.balance_after ?? null,
            source_hash:     t.source_hash ?? null,
            review_status:   'UNREVIEWED' as const,
            document_status: 'NOT_REQUIRED' as const,
            reconciliation_status: 'UNMATCHED' as const,
            risk_flag:       risk_flag as 'ROUND_NUMBER' | 'HIGH_VALUE' | 'DIRECTOR_RELATED' | 'RELATED_PARTY' | null,
            is_manual:       false,
          }
        })

        await prisma.transaction.createMany({ data: txnData })
        inserted = toInsert.length
      }
    }

    // Update batch status
    const updated = await prisma.importBatch.update({
      where: { id: body.import_batch_id },
      data: {
        import_status:              body.status,
        source_transaction_count:   body.source_transaction_count ?? body.transactions?.length,
        imported_transaction_count: inserted,
        unparsed_count:             body.unparsed_count ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parse_errors_json:          (body.parse_errors ? { errors: body.parse_errors } : undefined) as any,
      },
    })

    await writeAuditLog({
      table_name:  'import_batches',
      record_id:   body.import_batch_id,
      action:      'UPDATE',
      before_json: { import_status: 'PROCESSING' },
      after_json:  { import_status: body.status, inserted, skipped },
      actor_id:    'n8n-webhook',
    })

    return NextResponse.json({
      data: {
        import_batch_id: body.import_batch_id,
        status:   body.status,
        inserted,
        skipped,
        batch:    updated,
      },
    })
  } catch (err) {
    console.error('[webhook/import-complete]', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
