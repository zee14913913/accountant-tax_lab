// POST /api/tax-prep/[entityId]/generate
// Triggers n8n Workflow 6 — Tax Prep Generation
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const GenerateTaxPrepSchema = z.object({
  assessment_year: z.number().int().min(2000).max(2100),
  actor_id:        z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const body      = await req.json()
    const validated = GenerateTaxPrepSchema.parse(body)

    // Verify entity exists
    const entity = await prisma.entity.findFirst({
      where: { id: params.entityId, archived_at: null },
    })
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const webhookBase = process.env.N8N_WEBHOOK_BASE_URL
    if (!webhookBase) {
      console.warn('[tax-prep/generate] N8N_WEBHOOK_BASE_URL not set — skipping webhook call')
      return NextResponse.json({
        ok:      true,
        message: 'Tax prep generation queued (webhook not configured)',
      })
    }

    const webhookUrl = `${webhookBase}/webhook/tax-prep-generate`

    const webhookPayload = {
      entity_id:       params.entityId,
      assessment_year: validated.assessment_year,
      flow_type:       entity.flow_type,
      actor_id:        validated.actor_id,
      entity_name:     entity.entity_name,
      triggered_at:    new Date().toISOString(),
    }

    const response = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(webhookPayload),
    })

    if (!response.ok) {
      console.error('[tax-prep/generate] n8n webhook error:', response.status, await response.text())
      return NextResponse.json(
        { error: 'Failed to queue tax prep generation', webhook_status: response.status },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok:      true,
      message: 'Tax prep generation queued',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[POST /api/tax-prep/[entityId]/generate]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
