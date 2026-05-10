// GET /api/tax-prep/[entityId]?assessment_year=YYYY
// Main tax prep aggregation endpoint — computes everything needed for the tax prep workbench page.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─── Progressive Tax Brackets (Malaysia 2026 Individual) ──────────────────────
function progressiveTax(income: number): number {
  if (income <= 0) return 0

  const brackets = [
    { limit:    5000, rate: 0.00 },
    { limit:   20000, rate: 0.01 },
    { limit:   35000, rate: 0.03 },
    { limit:   50000, rate: 0.08 },
    { limit:   70000, rate: 0.13 },
    { limit:  100000, rate: 0.21 },
    { limit:  250000, rate: 0.24 },
    { limit:  400000, rate: 0.245 },
    { limit:  600000, rate: 0.25 },
    { limit: 1000000, rate: 0.26 },
    { limit: Infinity, rate: 0.30 },
  ]

  let tax      = 0
  let previous = 0

  for (const bracket of brackets) {
    if (income <= previous) break
    const taxable = Math.min(income, bracket.limit) - previous
    tax      += taxable * bracket.rate
    previous  = bracket.limit
  }

  return tax
}

// ─── SME Company Tax (Malaysia 2026) ─────────────────────────────────────────
// SME: paid-up capital ≤ RM2.5M → 17% first RM150k, 24% remainder
function companyTax(chargeableIncome: number): number {
  if (chargeableIncome <= 0) return 0
  const tier1 = Math.min(chargeableIncome, 150000)
  const tier2 = Math.max(chargeableIncome - 150000, 0)
  return tier1 * 0.17 + tier2 * 0.24
}

// ─── Applicable Form & Due Date by flow_type ──────────────────────────────────
function getFormInfo(
  flowType: string,
  assessmentYear: number
): { form: string; due_date: string; description: string } {
  switch (flowType) {
    case 'INDIVIDUAL_ONLY':
      return {
        form:        'BE',
        due_date:    `30 April ${assessmentYear + 1}`,
        description: 'Form BE — Employment income only. e-Filing via MyTax portal.',
      }
    case 'INDIVIDUAL_BUSINESS':
      return {
        form:        'B',
        due_date:    `30 June ${assessmentYear + 1}`,
        description: 'Form B — Business income (Schedule B). e-Filing via MyTax portal.',
      }
    case 'PARTNERSHIP':
      return {
        form:        'P',
        due_date:    `30 June ${assessmentYear + 1}`,
        description: 'Form P — Partnership-level return. Each partner files separately.',
      }
    case 'COMPANY':
      return {
        form:        'C',
        due_date:    '7 months after financial year end',
        description: 'Form C — Corporate tax return. CP204 installments every 2 months.',
      }
    default:
      return { form: '—', due_date: '—', description: '—' }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const rawYear          = searchParams.get('assessment_year')
    const assessmentYear   = rawYear ? parseInt(rawYear) : new Date().getFullYear()

    // 1. Load entity with flow_type and client
    const entity = await prisma.entity.findFirst({
      where:   { id: params.entityId, archived_at: null },
      include: {
        client: { select: { id: true, legal_name: true, display_name: true } },
      },
    })
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    // 2. Load filing profiles for this entity
    const filingProfiles = await prisma.filingProfile.findMany({
      where: {
        entity_id: params.entityId,
        ...(rawYear ? { assessment_year: assessmentYear } : {}),
      },
    })

    // 3. Load latest FINAL PnlSnapshot for the assessment year
    const periodStart = new Date(`${assessmentYear}-01-01T00:00:00.000Z`)
    const periodEnd   = new Date(`${assessmentYear}-12-31T23:59:59.999Z`)

    const pnlSnapshot = await prisma.pnlSnapshot.findFirst({
      where: {
        entity_id: params.entityId,
        is_final:  true,
        period_end: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { period_end: 'desc' },
    })

    // Fallback: latest snapshot even if not final
    const pnlFallback = !pnlSnapshot
      ? await prisma.pnlSnapshot.findFirst({
          where:   { entity_id: params.entityId, period_end: { gte: periodStart, lte: periodEnd } },
          orderBy: { generated_at: 'desc' },
        })
      : null

    const snapshot = pnlSnapshot ?? pnlFallback

    // 4. Load TaxAdjustments for entity + assessment_year
    const taxAdjustments = await prisma.taxAdjustment.findMany({
      where:   { entity_id: params.entityId, assessment_year: assessmentYear },
      orderBy: [{ adjustment_type: 'asc' }, { created_at: 'asc' }],
    })

    // 5. Load TaxReliefItems for entity + assessment_year
    const taxReliefItems = await prisma.taxReliefItem.findMany({
      where:   { entity_id: params.entityId, assessment_year: assessmentYear },
      orderBy: { relief_category: 'asc' },
    })

    // 6. Load FixedAssets for entity
    const fixedAssets = await prisma.fixedAsset.findMany({
      where:   { entity_id: params.entityId, status: { not: 'DISPOSED' } },
      orderBy: { asset_name: 'asc' },
    })

    // 7. Load Partners if PARTNERSHIP
    const partners = entity.flow_type === 'PARTNERSHIP'
      ? await prisma.partner.findMany({
          where:   { entity_id: params.entityId, is_active: true },
          orderBy: { partner_name: 'asc' },
        })
      : []

    // ─── Compute Tax Figures ──────────────────────────────────────────────────

    const netProfit = snapshot ? Number(snapshot.net_profit ?? 0) : 0

    // Sum add-backs (+) and deductions (-)
    let addBackTotal    = 0
    let deductionTotal  = 0
    for (const adj of taxAdjustments) {
      const amt = Number(adj.amount ?? 0)
      if (adj.is_deduction) deductionTotal  += amt
      else                  addBackTotal    += amt
    }

    const adjustedIncome = netProfit + addBackTotal - deductionTotal

    // Total personal reliefs (individual flow types only)
    const totalReliefs = ['INDIVIDUAL_ONLY', 'INDIVIDUAL_BUSINESS'].includes(entity.flow_type)
      ? taxReliefItems.reduce((sum, r) => sum + Number(r.claimed_amount ?? 0), 0)
      : 0

    // Chargeable income
    let chargeableIncome = 0
    if (entity.flow_type === 'COMPANY' || entity.flow_type === 'PARTNERSHIP') {
      chargeableIncome = adjustedIncome
    } else {
      chargeableIncome = Math.max(adjustedIncome - totalReliefs, 0)
    }

    // Estimated tax
    let estimatedTax = 0
    if (entity.flow_type === 'COMPANY') {
      estimatedTax = companyTax(chargeableIncome)
    } else if (entity.flow_type === 'PARTNERSHIP') {
      // Partnership tax shown per partner — entity itself doesn't pay tax
      estimatedTax = 0
    } else {
      estimatedTax = progressiveTax(chargeableIncome)
    }

    // Partnership: per-partner share computation
    const partnerShares = entity.flow_type === 'PARTNERSHIP'
      ? partners.map(p => {
          const sharePct         = Number(p.profit_share_percentage ?? 0) / 100
          const partnerIncome    = adjustedIncome * sharePct
          const partnerTax       = progressiveTax(Math.max(partnerIncome, 0))
          return {
            partner_id:       p.id,
            partner_name:     p.partner_name,
            share_pct:        Number(p.profit_share_percentage ?? 0),
            income_share:     partnerIncome,
            estimated_tax:    partnerTax,
          }
        })
      : []

    // Capital allowance totals
    const totalCA = fixedAssets.reduce((sum, a) => {
      return sum + Number(a.ca_initial_allowance ?? 0) + Number(a.ca_annual_allowance ?? 0)
    }, 0)

    // Company: CP204 installment schedule
    const cp204Installments = entity.flow_type === 'COMPANY'
      ? Array.from({ length: 6 }, (_, i) => ({
          installment_number: i + 1,
          month_offset:       (i + 1) * 2,
          amount:             estimatedTax / 12,
          note:               `Installment ${i + 1} of 12 (bi-monthly)`,
        }))
      : []

    const formInfo = getFormInfo(entity.flow_type, assessmentYear)

    return NextResponse.json({
      data: {
        entity: {
          id:          entity.id,
          entity_name: entity.entity_name,
          flow_type:   entity.flow_type,
          client:      entity.client,
        },
        assessment_year:    assessmentYear,
        filing_profiles:    filingProfiles,
        pnl_snapshot:       snapshot,
        tax_adjustments:    taxAdjustments,
        tax_relief_items:   taxReliefItems,
        fixed_assets:       fixedAssets,
        partners,

        // Computed summaries
        computation: {
          net_profit:        netProfit,
          add_back_total:    addBackTotal,
          deduction_total:   deductionTotal,
          adjusted_income:   adjustedIncome,
          total_reliefs:     totalReliefs,
          chargeable_income: chargeableIncome,
          estimated_tax:     estimatedTax,
          total_ca:          totalCA,
          partner_shares:    partnerShares,
          cp204_installments: cp204Installments,
        },

        form_info: formInfo,
      },
    })
  } catch (err) {
    console.error('[GET /api/tax-prep/[entityId]]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
