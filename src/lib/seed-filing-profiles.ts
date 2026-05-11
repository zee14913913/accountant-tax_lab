import { prisma } from '@/lib/prisma'

/**
 * Creates default FilingProfile records for a newly created entity,
 * based on its flow_type. Should be called immediately after entity creation.
 */
export async function createDefaultFilingProfiles(
  entityId: string,
  flowType: string
): Promise<void> {
  switch (flowType) {
    case 'INDIVIDUAL_ONLY': {
      await prisma.filingProfile.create({
        data: {
          entity_id:              entityId,
          filing_category:        'INCOME_TAX',
          filing_type:            'PERSONAL_INCOME_TAX',
          relevant_form:          'BE',
          filing_channel:         'e-Filing (MyTax)',
          due_month:              'April',
          due_notes:              'Deadline: 30 April 2026. e-Filing grace period: 15 May 2026 (15 extra days)',
          official_reference_url: 'https://mytax.hasil.gov.my',
          is_active:              true,
        },
      })
      break
    }

    case 'INDIVIDUAL_BUSINESS': {
      await prisma.filingProfile.createMany({
        data: [
          {
            entity_id:              entityId,
            filing_category:        'INCOME_TAX',
            filing_type:            'PERSONAL_INCOME_TAX_BUSINESS',
            relevant_form:          'B',
            filing_channel:         'e-Filing (MyTax)',
            due_month:              'June',
            due_notes:              'Deadline: 30 June 2026. e-Filing grace period: 15 July 2026',
            official_reference_url: null,
            is_active:              true,
          },
          {
            entity_id:              entityId,
            filing_category:        'PAYROLL_PCB',
            filing_type:            'EMPLOYER_RETURN',
            relevant_form:          'EA',
            filing_channel:         'Employer submits',
            due_month:              'February',
            due_notes:              'Employer must provide Form EA to employee by 28 February 2026. Form E & CP8D due 31 March 2026.',
            official_reference_url: null,
            is_active:              true,
          },
        ],
      })
      break
    }

    case 'PARTNERSHIP': {
      await prisma.filingProfile.create({
        data: {
          entity_id:              entityId,
          filing_category:        'INCOME_TAX',
          filing_type:            'PARTNERSHIP_RETURN',
          relevant_form:          'P',
          filing_channel:         'e-Filing (MyTax)',
          due_month:              'June',
          due_notes:              'Deadline: 30 June 2026. e-Filing grace period: 15 July 2026. Partnership does not pay tax — each partner files Form B/BE individually.',
          official_reference_url: null,
          is_active:              true,
        },
      })
      break
    }

    case 'COMPANY': {
      await prisma.filingProfile.createMany({
        data: [
          {
            entity_id:              entityId,
            filing_category:        'INCOME_TAX',
            filing_type:            'COMPANY_INCOME_TAX',
            relevant_form:          'C',
            filing_channel:         'e-Filing (MyTax / e-C)',
            due_month:              'Variable',
            due_notes:              'Due within 7 months from financial year end. e-Filing: 8 months from FYE. Example: FYE 31 Dec 2025 → e-Filing by 31 August 2026.',
            official_reference_url: 'https://mytax.hasil.gov.my',
            is_active:              true,
          },
          {
            entity_id:              entityId,
            filing_category:        'INCOME_TAX',
            filing_type:            'TAX_ESTIMATE',
            relevant_form:          'CP204',
            filing_channel:         'e-Filing',
            due_month:              'Variable',
            due_notes:              'CP204 must be submitted 30 days before the beginning of the basis period. Monthly instalments due by 15th of each month.',
            official_reference_url: null,
            is_active:              true,
          },
        ],
      })
      break
    }

    default:
      // Unknown flow_type — no profiles created
      break
  }
}
