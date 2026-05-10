import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const PatchPackSchema = z.object({
  pack_name: z.string().min(1).optional(),
  status:    z.enum(['DRAFT', 'FINALISED', 'SENT', 'ARCHIVED']).optional(),
  notes:     z.string().optional(),
  sent_to:   z.string().optional(),
  actor_id:  z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/auditor-pack/[id]
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pack = await prisma.auditorPackage.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: { sort_order: 'asc' } },
      entity: {
        select: {
          entity_name: true,
          flow_type:   true,
          client:      { select: { display_name: true, legal_name: true } },
        },
      },
    },
  })

  if (!pack) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  return NextResponse.json({ data: pack })
}

// ---------------------------------------------------------------------------
// PATCH /api/auditor-pack/[id]
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body      = await request.json()
    const validated = PatchPackSchema.parse(body)

    const existing = await prisma.auditorPackage.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (validated.pack_name !== undefined) updateData.pack_name = validated.pack_name
    if (validated.notes     !== undefined) updateData.notes     = validated.notes
    if (validated.sent_to   !== undefined) updateData.sent_to   = validated.sent_to

    if (validated.status) {
      updateData.status = validated.status
      const now = new Date()

      if (validated.status === 'FINALISED') {
        updateData.finalised_by = validated.actor_id ?? 'system'
        updateData.finalised_at = now
      }
      if (validated.status === 'SENT') {
        updateData.sent_at = now
      }
      if (validated.status === 'ARCHIVED') {
        updateData.archived_at = now
      }
    }

    const updated = await prisma.auditorPackage.update({
      where: { id: params.id },
      data:  updateData,
      include: {
        items: { orderBy: { sort_order: 'asc' } },
        entity: {
          select: {
            entity_name: true,
            flow_type:   true,
            client:      { select: { display_name: true, legal_name: true } },
          },
        },
      },
    })

    await writeAuditLog({
      table_name: 'auditor_packages',
      record_id:  params.id,
      action:     'UPDATE',
      before_json: existing,
      after_json:  updateData,
      actor_id:    validated.actor_id ?? 'system',
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[auditor-pack PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
