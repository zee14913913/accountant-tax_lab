import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { PackItemType } from '@prisma/client'

const WebhookSchema = z.object({
  package_id:    z.string().min(1),
  item_type:     z.nativeEnum(PackItemType as Record<string, PackItemType>),
  status:        z.enum(['GENERATED', 'FAILED', 'SKIPPED']),
  file_url:      z.string().url().optional(),
  file_name:     z.string().optional(),
  error_message: z.string().optional(),
  secret:        z.string().min(1),
})

// ---------------------------------------------------------------------------
// POST /api/webhooks/n8n/auditor-pack-complete
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = WebhookSchema.parse(body)

    // Verify shared secret
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET
    if (!expectedSecret || validated.secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // Find the matching item
    const item = await prisma.auditorPackageItem.findFirst({
      where: {
        package_id: validated.package_id,
        item_type:  validated.item_type,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Update the item
    const updateData: Record<string, unknown> = {
      status:        validated.status,
      error_message: validated.error_message ?? null,
    }
    if (validated.file_url)  updateData.file_url  = validated.file_url
    if (validated.file_name) updateData.file_name = validated.file_name
    if (validated.status === 'GENERATED') updateData.generated_at = new Date()

    await prisma.auditorPackageItem.update({
      where: { id: item.id },
      data:  updateData,
    })

    // Check if all items in the package are done (GENERATED/FAILED/SKIPPED = not PENDING)
    const allItems = await prisma.auditorPackageItem.findMany({
      where: { package_id: validated.package_id },
      select: { status: true },
    })

    const allDone   = allItems.every(i => i.status !== 'PENDING')
    const allPassed = allItems.every(i => i.status === 'GENERATED')

    if (allDone && allPassed) {
      await prisma.auditorPackage.update({
        where: { id: validated.package_id },
        data:  {
          status:       'FINALISED',
          finalised_by: 'n8n',
          finalised_at: new Date(),
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[auditor-pack-complete webhook]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
