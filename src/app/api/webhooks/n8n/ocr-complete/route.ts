/**
 * POST /api/webhooks/n8n/ocr-complete
 * Callback from n8n after OCR processing.
 * Stores extracted text and structured JSON.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

interface OcrCompletePayload {
  secret:       string
  document_id:  string
  status:       'COMPLETED' | 'FAILED'
  ocr_text?:    string
  extracted_json?: {
    invoice_no?:    string
    invoice_date?:  string
    vendor_name?:   string
    vendor_regno?:  string
    vendor_tin?:    string
    total_amount?:  number
    tax_amount?:    number
    line_items?:    Array<{ description: string; qty: number; unit_price: number; amount: number }>
    raw_fields?:    Record<string, string>
  }
  error_message?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: OcrCompletePayload = await request.json()

    const expectedSecret = process.env.N8N_WEBHOOK_SECRET ?? ''
    if (expectedSecret && body.secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const doc = await prisma.supportingDocument.findFirst({
      where: { id: body.document_id },
    })

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const updated = await prisma.supportingDocument.update({
      where: { id: body.document_id },
      data: {
        ocr_status:     body.status,
        ocr_text:       body.ocr_text ?? null,
        extracted_json: body.extracted_json ?? undefined,
      },
    })

    await writeAuditLog({
      table_name:  'supporting_documents',
      record_id:   body.document_id,
      action:      'UPDATE',
      before_json: { ocr_status: 'PROCESSING' },
      after_json:  {
        ocr_status: body.status,
        has_text:   !!body.ocr_text,
        has_json:   !!body.extracted_json,
      },
      actor_id:    'n8n-ocr-webhook',
    })

    return NextResponse.json({
      data: { document_id: body.document_id, ocr_status: body.status },
    })
  } catch (err) {
    console.error('[webhook/ocr-complete]', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
