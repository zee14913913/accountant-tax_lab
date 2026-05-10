import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { PackItemType } from '@prisma/client'

const GenerateSchema = z.object({
  actor_id: z.string().min(1),
  items:    z.array(z.nativeEnum(PackItemType as Record<string, PackItemType>)).optional(),
})

// ---------------------------------------------------------------------------
// POST /api/auditor-pack/[id]/generate
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body      = await request.json()
    const validated = GenerateSchema.parse(body)

    // Load package with entity and items
    const pack = await prisma.auditorPackage.findUnique({
      where: { id: params.id },
      include: {
        entity: { select: { id: true, flow_type: true } },
        items:  true,
      },
    })

    if (!pack) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // Determine which items to generate
    const items_requested: string[] = validated.items ?? pack.items.map(i => i.item_type)

    // POST to n8n webhook
    const n8nUrl = `${process.env.N8N_WEBHOOK_BASE_URL}/webhook/auditor-pack-generate`

    try {
      await fetch(n8nUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          package_id:      pack.id,
          entity_id:       pack.entity.id,
          flow_type:       pack.entity.flow_type,
          items_requested,
        }),
      })
    } catch (fetchErr) {
      console.error('[auditor-pack generate] n8n webhook call failed:', fetchErr)
      // Non-fatal — we still queue the job locally
    }

    await writeAuditLog({
      table_name: 'auditor_packages',
      record_id:  params.id,
      action:     'UPDATE',
      after_json: { action: 'generate_triggered', items_requested },
      actor_id:   validated.actor_id,
    })

    return NextResponse.json({
      ok:         true,
      message:    'Pack generation queued',
      package_id: pack.id,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[auditor-pack generate POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
