/**
 * POST /api/documents/[id]/ocr
 *
 * Triggers OCR processing for a supporting document via n8n.
 * Sets ocr_status to PROCESSING and fires the n8n OCR webhook.
 * n8n will process the file and call back /api/webhooks/n8n/ocr-complete.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const doc = await prisma.supportingDocument.findFirst({
    where: { id: params.id, archived_at: null },
    include: {
      entity: { select: { flow_type: true } },
    },
  })

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  if (doc.ocr_status === 'PROCESSING') {
    return NextResponse.json({ error: 'OCR is already in progress' }, { status: 409 })
  }

  if (doc.ocr_status === 'COMPLETED') {
    return NextResponse.json({ error: 'OCR already completed. Re-trigger via document update.' }, { status: 409 })
  }

  // Mark as PROCESSING
  await prisma.supportingDocument.update({
    where: { id: params.id },
    data:  { ocr_status: 'PROCESSING' },
  })

  await writeAuditLog({
    table_name: 'supporting_documents',
    record_id:  params.id,
    action:     'UPDATE',
    before_json: { ocr_status: doc.ocr_status },
    after_json:  { ocr_status: 'PROCESSING' },
    actor_id:    'system',
  })

  // Fire n8n OCR webhook
  const n8nBaseUrl = process.env.N8N_WEBHOOK_BASE_URL ?? 'http://localhost:5678'
  const n8nSecret  = process.env.N8N_WEBHOOK_SECRET ?? ''
  const webhookUrl = `${n8nBaseUrl}/webhook/ocr-process`

  const payload = {
    document_id:   doc.id,
    file_url:      doc.file_url,
    file_name:     doc.file_name,
    document_type: doc.document_type,
    flow_type:     doc.entity?.flow_type,
    callback_url:  `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/webhooks/n8n/ocr-complete`,
    secret:        n8nSecret,
  }

  try {
    const n8nResponse = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(10000),
    })

    if (!n8nResponse.ok) {
      await prisma.supportingDocument.update({
        where: { id: params.id },
        data:  { ocr_status: 'PENDING' },
      })
      return NextResponse.json({ error: 'OCR service rejected request' }, { status: 502 })
    }
  } catch {
    await prisma.supportingDocument.update({
      where: { id: params.id },
      data:  { ocr_status: 'PENDING' },
    })
    return NextResponse.json({
      error: 'OCR service unavailable',
      detail: 'n8n is not reachable. Ensure N8N_WEBHOOK_BASE_URL is set correctly.',
    }, { status: 503 })
  }

  return NextResponse.json({
    data: { document_id: params.id, ocr_status: 'PROCESSING' },
  })
}
