// GET /api/tax-adjustments?entity_id=X&assessment_year=YYYY
// POST /api/tax-adjustments — create new TaxAdjustment
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

const CreateTaxAdjustmentSchema = z.object({
  entity_id:        z.string().min(1),
  assessment_year:  z.number().int().min(2000).max(2100),
  flow_type:        z.enum(['INDIVIDUAL_ONLY', 'INDIVIDUAL_BUSINESS', 'PARTNERSHIP', 'COMPANY']),
  adjustment_type:  z.enum([
    'ADD_BACK_NON_DEDUCTIBLE',
    'DEDUCT_CAPITAL_ALLOWANCE',
    'DEDUCT_INDUSTRIAL_BUILDING_ALLOWANCE',
    'DEDUCT_ACCELERATED_CA',
    'DEDUCT_REINVESTMENT_ALLOWANCE',
    'DEDUCT_PIONEER_STATUS_EXEMPTION',
    'ADD_DEEMED_INCOME',
    'DEDUCT_LOSS_CARRIED_FORWARD',
    'DEDUCT_UNABSORBED_CA',
    'PERSONAL_RELIEF_SELF',
    'PERSONAL_RELIEF_SPOUSE',
    'PERSONAL_RELIEF_CHILD',
    'PERSONAL_RELIEF_MEDICAL',
    'PERSONAL_RELIEF_EDUCATION',
    'PERSONAL_RELIEF_EPF_SOCSO',
    'PERSONAL_RELIEF_LIFESTYLE',
    'PERSONAL_RELIEF_EQUIPMENT_DISABLED',
    'PERSONAL_RELIEF_INSURANCE',
    'PERSONAL_RELIEF_SSPN',
    'PERSONAL_RELIEF_EV_CHARGING',
    'PERSONAL_RELIEF_DOMESTIC_TRAVEL',
    'PERSONAL_RELIEF_BREASTFEEDING',
    'SCHEDULE_B_GROSS_INCOME',
    'SCHEDULE_B_ALLOWABLE_EXPENSE',
    'SCHEDULE_B_ADJUSTED_INCOME',
    'PARTNERSHIP_APPORTIONMENT',
    'DIRECTOR_REMUNERATION',
    'OTHER_ADJUSTMENT',
  ]),
  label:               z.string().min(1).max(255),
  amount:              z.number(),
  is_deduction:        z.boolean(),
  lhdn_ref:            z.string().optional(),
  supporting_doc_id:   z.string().optional(),
  notes:               z.string().optional(),
  created_by:          z.string().min(1),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const entity_id       = searchParams.get('entity_id')
    const assessment_year = searchParams.get('assessment_year')

    if (!entity_id) {
      return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { entity_id }
    if (assessment_year) {
      where.assessment_year = parseInt(assessment_year)
    }

    const adjustments = await prisma.taxAdjustment.findMany({
      where,
      orderBy: [
        { adjustment_type: 'asc' },
        { created_at: 'asc' },
      ],
      include: {
        entity: {
          select: {
            id: true,
            entity_name: true,
            flow_type: true,
          },
        },
      },
    })

    return NextResponse.json({ data: adjustments })
  } catch (err) {
    console.error('[GET /api/tax-adjustments]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body      = await req.json()
    const validated = CreateTaxAdjustmentSchema.parse(body)

    // Verify entity exists
    const entity = await prisma.entity.findFirst({
      where: { id: validated.entity_id, archived_at: null },
    })
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const adjustment = await prisma.taxAdjustment.create({
      data: {
        entity_id:         validated.entity_id,
        assessment_year:   validated.assessment_year,
        flow_type:         validated.flow_type,
        adjustment_type:   validated.adjustment_type,
        label:             validated.label,
        amount:            validated.amount,
        is_deduction:      validated.is_deduction,
        lhdn_ref:          validated.lhdn_ref ?? null,
        supporting_doc_id: validated.supporting_doc_id ?? null,
        notes:             validated.notes ?? null,
        status:            'DRAFT',
        created_by:        validated.created_by,
      },
    })

    await writeAuditLog({
      table_name: 'tax_adjustments',
      record_id:  adjustment.id,
      action:     'CREATE',
      after_json: {
        entity_id:       validated.entity_id,
        assessment_year: validated.assessment_year,
        adjustment_type: validated.adjustment_type,
        amount:          validated.amount,
        is_deduction:    validated.is_deduction,
      },
      actor_id: validated.created_by,
    })

    return NextResponse.json({ data: adjustment }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[POST /api/tax-adjustments]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
