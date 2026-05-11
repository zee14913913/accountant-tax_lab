export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FileText } from 'lucide-react'

const FILING_CATEGORY_LABELS: Record<string, string> = {
  INCOME_TAX:       'Income Tax',
  SST_SALES_TAX:    'SST Sales Tax',
  SST_SERVICE_TAX:  'SST Service Tax',
  E_INVOICE:        'e-Invoice',
  AUDIT:            'Audit',
  ANNUAL_RETURN:    'Annual Return',
  PAYROLL_PCB:      'Payroll PCB',
  OTHER:            'Other',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_TAX:      'Individual Tax',
  SOLE_PROPRIETORSHIP: 'Sole Prop',
  ENTERPRISE:          'Enterprise',
  PARTNERSHIP:         'Partnership',
  SDN_BHD:             'Sdn Bhd',
  BHD:                 'Bhd',
  LLP:                 'LLP',
  FREELANCE:           'Freelance',
}

export default async function FilingProfilesPage() {
  const profiles = await prisma.filingProfile.findMany({
    where: { is_active: true },
    include: {
      entity: {
        include: {
          client: true,
        },
      },
    },
    orderBy: { entity: { entity_name: 'asc' } },
  })

  // Group by entity
  const grouped = profiles.reduce<
    Record<
      string,
      {
        entity: (typeof profiles)[0]['entity']
        profiles: typeof profiles
      }
    >
  >((acc, profile) => {
    const eid = profile.entity_id
    if (!acc[eid]) {
      acc[eid] = { entity: profile.entity, profiles: [] }
    }
    acc[eid].profiles.push(profile)
    return acc
  }, {})

  const entityGroups = Object.values(grouped)

  return (
    <div>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Filing Profiles</h1>
          <p className="page-subtitle">
            {profiles.length} active profile{profiles.length !== 1 ? 's' : ''} across{' '}
            {entityGroups.length} {entityGroups.length === 1 ? 'entity' : 'entities'}
          </p>
        </div>
      </div>

      {/* ── Empty State ───────────────────────────────────────────────────── */}
      {profiles.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <FileText size={36} className="text-ink-muted mx-auto mb-4" />
            <p className="text-body font-medium text-ink-primary mb-1">No filing profiles</p>
            <p className="text-label text-ink-muted max-w-sm mx-auto">
              Filing profiles are created automatically when you create an entity.{' '}
              Go to{' '}
              <Link href="/entities" className="text-ink-secondary hover:text-ink-primary underline">
                /entities
              </Link>{' '}
              to set up entities.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {entityGroups.map(({ entity, profiles: entityProfiles }) => (
            <Card key={entity.id} className="p-0 overflow-hidden">
              {/* Entity header */}
              <div className="px-6 py-4 border-b border-divider flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/entities/${entity.id}`}
                        className="text-card-title font-semibold text-ink-primary hover:text-ink-primary/80"
                      >
                        {entity.entity_name}
                      </Link>
                      <Badge variant="neutral">
                        {ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}
                      </Badge>
                    </div>
                    <p className="text-label text-ink-muted mt-0.5">
                      {entity.client.display_name ?? entity.client.legal_name}
                      {' · '}
                      <span className="font-mono">{entity.client.client_code}</span>
                    </p>
                  </div>
                </div>
                <span className="text-label text-ink-muted">
                  {entityProfiles.length} profile{entityProfiles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Profiles table */}
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="py-2.5 px-4">Filing Type</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Relevant Form</th>
                    <th className="py-2.5 px-4">Due Month</th>
                    <th className="py-2.5 px-4">Filing Channel</th>
                    <th className="py-2.5 px-4">Official Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {entityProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="py-2.5 px-4 font-medium text-ink-primary">
                        {profile.filing_type}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="neutral">
                          {FILING_CATEGORY_LABELS[profile.filing_category] ?? profile.filing_category}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-ink-secondary text-label">
                        {profile.relevant_form ?? '—'}
                      </td>
                      <td className="py-2.5 px-4 text-ink-secondary text-label">
                        {profile.due_month ?? '—'}
                      </td>
                      <td className="py-2.5 px-4 text-ink-secondary text-label">
                        {profile.filing_channel ?? '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        {profile.official_reference_url ? (
                          <a
                            href={profile.official_reference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-label text-ink-secondary hover:text-ink-primary underline truncate max-w-[180px] block"
                          >
                            {profile.official_reference_url}
                          </a>
                        ) : (
                          <span className="text-label text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
