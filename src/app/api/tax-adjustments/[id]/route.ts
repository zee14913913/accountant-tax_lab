// GET    /api/tax-adjustments/[id] — fetch single TaxAdjustment
// PATCH  /api/tax-adjustments/[id] — update TaxAdjustment fields
// TaxAdjustments are immutable audit records — no hard delete
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

const PatchTaxAdjustmentSchema = z.object({
  label:        z.string().min(1).max(255).optional(),
  amount:       z.number().optional(),
  is_deduction: z.boolean().optional(),
  lhdn_ref:     z.string().nullable().optional(),
  notes:        z.string().nullable().optional(),
  status:       z.enum(['DRAFT', 'CONFIRMED', 'SUBMITTED', 'AMENDED']).optional(),
  updated_by:   z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adjustment = await prisma.taxAdjustment.findUnique({
      where: { id: (await params).id },
      include: {
        entity: {
          select: {
            id: true,
            entity_name: true,
            flow_type: true,
            client: { select: { legal_name: true, display_name: true } },
          },
        },
      },
    })

    if (!adjustment) {
      return NextResponse.json({ error: 'TaxAdjustment not found' }, { status: 404 })
    }

    return NextResponse.json({ data: adjustment })
  } catch (err) {
    console.error('[GET /api/tax-adjustments/[id]]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body      = await req.json()
    const validated = PatchTaxAdjustmentSchema.parse(body)

    const existing = await prisma.taxAdjustment.findUnique({
      where: { id: (await params).id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'TaxAdjustment not found' }, { status: 404 })
    }

    // Build update payload — only provided fields
    const updateData: Record<string, unknown> = {}
    if (validated.label        !== undefined) updateData.label        = validated.label
    if (validated.amount       !== undefined) updateData.amount       = validated.amount
    if (validated.is_deduction !== undefined) updateData.is_deduction = validated.is_deduction
    if (validated.lhdn_ref     !== undefined) updateData.lhdn_ref     = validated.lhdn_ref
    if (validated.notes        !== undefined) updateData.notes        = validated.notes
    if (validated.status       !== undefined) updateData.status       = validated.status

    const updated = await prisma.taxAdjustment.update({
      where: { id: (await params).id },
      data:  updateData,
    })

    await writeAuditLog({
      table_name: 'tax_adjustments',
      record_id:  (await params).id,
      action:     'UPDATE',
      before_json: {
        label:        existing.label,
        amount:       existing.amount,
        is_deduction: existing.is_deduction,
        status:       existing.status,
      },
      after_json: {
        label:        updated.label,
        amount:       updated.amount,
        is_deduction: updated.is_deduction,
        status:       updated.status,
      },
      actor_id: validated.updated_by ?? 'system',
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[PATCH /api/tax-adjustments/[id]]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
