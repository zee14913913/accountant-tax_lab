export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { TaxPrepWorkbench } from '@/components/tax-prep/TaxPrepWorkbench'

interface Props {
  params: Promise<{ entityId: string }>
}

export default async function TaxPrepEntityPage({ params }: Props) {
  const { entityId } = await params

  const entity = await prisma.entity.findUnique({
    where:   { id: entityId },
    include: {
      client: {
        select: {
          legal_name:   true,
          display_name: true,
        },
      },
    },
  })

  if (!entity) {
    notFound()
  }

  // Serialise to plain object for the client component
  const entityData = {
    id:                 entity.id,
    entity_name:        entity.entity_name,
    entity_type:        entity.entity_type,
    flow_type:          entity.flow_type as 'INDIVIDUAL_ONLY' | 'INDIVIDUAL_BUSINESS' | 'PARTNERSHIP' | 'COMPANY',
    financial_year_end: entity.financial_year_end,
    tax_reference_no:   entity.tax_reference_no,
    client: {
      legal_name:   entity.client.legal_name,
      display_name: entity.client.display_name,
    },
  }

  return (
    <div className="page-content">
      {/* Back navigation */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/tax-prep"
          style={{
            fontSize: 13,
            color: '#5E5E5E',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Tax Preparation
        </Link>
      </div>

      <TaxPrepWorkbench entity={entityData} />
    </div>
  )
}
