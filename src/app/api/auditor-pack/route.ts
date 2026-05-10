import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'
import { PackItemType } from '@prisma/client'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const CreatePackSchema = z.object({
  entity_id:       z.string().min(1),
  period_start:    z.string().min(1),
  period_end:      z.string().min(1),
  assessment_year: z.number().int().optional(),
  pack_name:       z.string().min(1),
  prepared_by:     z.string().min(1),
  notes:           z.string().optional(),
})

// ---------------------------------------------------------------------------
// Item templates per flow_type
// ---------------------------------------------------------------------------
const BASE_ITEMS: PackItemType[] = [
  'PNL_STATEMENT',
  'TRANSACTION_LIST',
  'DOCUMENT_MANIFEST',
  'CHECKLIST_EXPORT',
  'UNRESOLVED_ISSUES_REPORT',
  'AUDIT_TRAIL',
]

const INDIVIDUAL_BUSINESS_ITEMS: PackItemType[] = ['FIXED_ASSET_SCHEDULE', 'TAX_COMPUTATION']
const PARTNERSHIP_ITEMS: PackItemType[] = ['PARTNER_LEDGER']
const COMPANY_ITEMS: PackItemType[] = ['BALANCE_SHEET_SUMMARY']

function getItemsForFlowType(flow_type: string): PackItemType[] {
  const items: PackItemType[] = [...BASE_ITEMS]

  if (flow_type === 'INDIVIDUAL_BUSINESS' || flow_type === 'PARTNERSHIP' || flow_type === 'COMPANY') {
    items.push(...INDIVIDUAL_BUSINESS_ITEMS)
  }
  if (flow_type === 'PARTNERSHIP') {
    items.push(...PARTNERSHIP_ITEMS)
  }
  if (flow_type === 'COMPANY') {
    items.push(...COMPANY_ITEMS)
  }
  return items
}

const ITEM_LABELS: Record<PackItemType, string> = {
  PNL_STATEMENT:           'P&L Statement',
  BALANCE_SHEET_SUMMARY:   'Balance Sheet Summary',
  TRANSACTION_LIST:        'Transaction List',
  DOCUMENT_MANIFEST:       'Document Manifest',
  CHECKLIST_EXPORT:        'Closing Checklist',
  TAX_COMPUTATION:         'Tax Computation',
  UNRESOLVED_ISSUES_REPORT:'Unresolved Issues Report',
  AUDIT_TRAIL:             'Audit Trail',
  FIXED_ASSET_SCHEDULE:    'Fixed Asset Schedule',
  PARTNER_LEDGER:          'Partner Ledger',
  CUSTOM:                  'Custom Item',
}

// ---------------------------------------------------------------------------
// GET /api/auditor-pack
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entity_id = searchParams.get('entity_id')
  const status    = searchParams.get('status')
  const limit     = parseInt(searchParams.get('limit')  ?? '20', 10)
  const offset    = parseInt(searchParams.get('offset') ?? '0',  10)

  const where: Record<string, unknown> = {}
  if (entity_id) where.entity_id = entity_id
  if (status)    where.status = status

  const [data, total] = await Promise.all([
    prisma.auditorPackage.findMany({
      where,
      include: {
        entity: {
          select: {
            entity_name: true,
            flow_type:   true,
            client:      { select: { display_name: true, legal_name: true } },
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { created_at: 'desc' },
      take:    limit,
      skip:    offset,
    }),
    prisma.auditorPackage.count({ where }),
  ])

  return NextResponse.json({ data, meta: { total, limit, offset } })
}

// ---------------------------------------------------------------------------
// POST /api/auditor-pack
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const validated = CreatePackSchema.parse(body)

    // Fetch entity to determine flow_type
    const entity = await prisma.entity.findUnique({
      where: { id: validated.entity_id },
      select: { flow_type: true },
    })
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const itemTypes = getItemsForFlowType(entity.flow_type)

    const pack = await prisma.auditorPackage.create({
      data: {
        entity_id:       validated.entity_id,
        period_start:    new Date(validated.period_start),
        period_end:      new Date(validated.period_end),
        assessment_year: validated.assessment_year,
        pack_name:       validated.pack_name,
        prepared_by:     validated.prepared_by,
        notes:           validated.notes,
        status:          'DRAFT',
        items: {
          create: itemTypes.map((item_type, index) => ({
            item_type,
            item_label: ITEM_LABELS[item_type],
            status:     'PENDING' as const,
            sort_order: index,
          })),
        },
      },
      include: {
        items:  true,
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
      record_id:  pack.id,
      action:     'CREATE',
      after_json: { ...pack, items: pack.items.length },
      actor_id:   validated.prepared_by,
    })

    return NextResponse.json({ data: pack }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[auditor-pack POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
