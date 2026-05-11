/**
 * POST /api/imports/[id]/process
 *
 * Triggers the n8n import parsing workflow for a given ImportBatch.
 * Sets import_status to PROCESSING and fires the n8n webhook.
 * n8n will parse the file, create transactions, then call back
 * /api/webhooks/n8n/import-complete to update the batch status.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const batch = await prisma.importBatch.findFirst({
    where:   { id: (await params).id, archived_at: null },
    include: {
      entity:       { select: { id: true, entity_name: true, flow_type: true } },
      bank_account: { select: { id: true, bank_name: true, account_no: true, currency: true } },
    },
  })

  if (!batch) return NextResponse.json({ error: 'Import batch not found' }, { status: 404 })

  if (batch.import_status === 'PROCESSING') {
    return NextResponse.json({ error: 'Batch is already being processed' }, { status: 409 })
  }

  if (batch.import_status === 'COMPLETED') {
    return NextResponse.json({ error: 'Batch has already been completed. Archive and re-upload to reprocess.' }, { status: 409 })
  }

  // Mark as PROCESSING
  await prisma.importBatch.update({
    where: { id: (await params).id },
    data:  { import_status: 'PROCESSING' },
  })

  await writeAuditLog({
    table_name:  'import_batches',
    record_id:   (await params).id,
    action:      'UPDATE',
    before_json: { import_status: batch.import_status },
    after_json:  { import_status: 'PROCESSING' },
    actor_id:    'system',
  })

  // Fire n8n webhook
  const n8nBaseUrl    = process.env.N8N_WEBHOOK_BASE_URL ?? 'http://localhost:5678'
  const n8nSecret     = process.env.N8N_WEBHOOK_SECRET ?? ''
  const webhookUrl    = `${n8nBaseUrl}/webhook/import-parse`

  const payload = {
    import_batch_id:  batch.id,
    entity_id:        batch.entity_id,
    bank_account_id:  batch.bank_account_id,
    source_file_url:  batch.source_file_url,
    source_type:      batch.source_type,
    bank_name:        batch.bank_account?.bank_name,
    statement_month:  batch.statement_month,
    flow_type:        batch.entity?.flow_type,
    callback_url:     `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/webhooks/n8n/import-complete`,
    secret:           n8nSecret,
  }

  try {
    const n8nResponse = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(10000),
    })

    if (!n8nResponse.ok) {
      // Revert to PENDING if n8n failed to accept
      await prisma.importBatch.update({
        where: { id: (await params).id },
        data:  { import_status: 'PENDING' },
      })
      const errText = await n8nResponse.text()
      console.error('[process] n8n webhook rejected:', errText)
      return NextResponse.json({ error: 'Failed to trigger parser workflow', detail: errText }, { status: 502 })
    }
  } catch (err) {
    // Network error — revert
    await prisma.importBatch.update({
      where: { id: (await params).id },
      data:  { import_status: 'PENDING' },
    })
    console.error('[process] n8n webhook error:', err)
    return NextResponse.json({
      error: 'Parser service unavailable',
      detail: 'n8n is not reachable. Ensure n8n is running and N8N_WEBHOOK_BASE_URL is correctly set.',
    }, { status: 503 })
  }

  return NextResponse.json({
    data: {
      import_batch_id: (await params).id,
      status: 'PROCESSING',
      message: 'Parser workflow triggered. Transactions will appear once processing completes.',
    },
  })
}
