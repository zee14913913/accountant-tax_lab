import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreatePartnerSchema = z.object({
  entity_id:               z.string(),
  partner_name:            z.string().min(1),
  identification_no:       z.string().optional(),
  tax_no:                  z.string().optional(),
  profit_share_percentage: z.number().min(0).max(100).optional(),
  capital_contribution:    z.number().optional(),
  notes:                   z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entity_id = searchParams.get('entity_id')

  if (!entity_id) {
    return NextResponse.json({ error: 'entity_id query param is required' }, { status: 400 })
  }

  const partners = await prisma.partner.findMany({
    where: { entity_id, is_active: true },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json({ data: partners })
}

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreatePartnerSchema.parse(body)

    const partner = await prisma.partner.create({
      data: {
        entity_id:               validated.entity_id,
        partner_name:            validated.partner_name,
        identification_no:       validated.identification_no,
        tax_no:                  validated.tax_no,
        profit_share_percentage: validated.profit_share_percentage ?? 0,
        capital_contribution:    validated.capital_contribution,
        notes:                   validated.notes,
      },
    })

    return NextResponse.json({ data: partner }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[POST /api/partners]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
