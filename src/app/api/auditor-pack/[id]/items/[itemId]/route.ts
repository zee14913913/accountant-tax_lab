import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const PatchItemSchema = z.object({
  status:        z.enum(['PENDING', 'GENERATED', 'FAILED', 'SKIPPED']).optional(),
  file_url:      z.string().url().optional(),
  file_name:     z.string().optional(),
  error_message: z.string().optional(),
  meta_json:     z.record(z.unknown()).optional(),
  actor_id:      z.string().optional(),
})

// ---------------------------------------------------------------------------
// PATCH /api/auditor-pack/[id]/items/[itemId]
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const body      = await request.json()
    const validated = PatchItemSchema.parse(body)

    const existing = await prisma.auditorPackageItem.findUnique({
      where: { id: params.itemId },
    })

    if (!existing || existing.package_id !== params.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (validated.status        !== undefined) updateData.status        = validated.status
    if (validated.file_url      !== undefined) updateData.file_url      = validated.file_url
    if (validated.file_name     !== undefined) updateData.file_name     = validated.file_name
    if (validated.error_message !== undefined) updateData.error_message = validated.error_message
    if (validated.meta_json     !== undefined) updateData.meta_json     = validated.meta_json

    if (validated.status === 'GENERATED') {
      updateData.generated_at = new Date()
    }

    const updated = await prisma.auditorPackageItem.update({
      where: { id: params.itemId },
      data:  updateData,
    })

    await writeAuditLog({
      table_name: 'auditor_package_items',
      record_id:  params.itemId,
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
    console.error('[auditor-pack item PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
