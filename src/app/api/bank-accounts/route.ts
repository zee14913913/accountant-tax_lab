import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateBankAccountSchema = z.object({
  entity_id:       z.string(),
  bank_name:       z.string().min(1),
  account_name:    z.string().min(1),
  account_no:      z.string().min(1),
  currency:        z.string().default('MYR'),
  account_type:    z.enum(['CURRENT', 'SAVINGS', 'FIXED_DEPOSIT', 'CREDIT_CARD', 'E_WALLET', 'OTHER']),
  opening_balance: z.number().optional(),
  opening_date:    z.string().optional(),
  current_status:  z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entity_id = searchParams.get('entity_id')
  const is_active = searchParams.get('is_active')

  const where: Record<string, unknown> = { archived_at: null }
  if (entity_id) where.entity_id = entity_id
  if (is_active === 'true')  where.is_active = true
  if (is_active === 'false') where.is_active = false

  const accounts = await prisma.bankAccount.findMany({
    where,
    include: {
      entity: {
        select: {
          id: true, entity_name: true, flow_type: true,
          client: { select: { id: true, legal_name: true, client_code: true } },
        },
      },
      _count: { select: { transactions: true, import_batches: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ data: accounts })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = CreateBankAccountSchema.parse(body)

    const account = await prisma.bankAccount.create({
      data: {
        ...validated,
        opening_date: validated.opening_date ? new Date(validated.opening_date) : undefined,
      },
    })

    await writeAuditLog({
      table_name: 'bank_accounts',
      record_id:  account.id,
      action:     'CREATE',
      after_json: account,
      actor_id:   'system',
    })

    return NextResponse.json({ data: account }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
