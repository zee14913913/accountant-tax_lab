import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateBankAccountSchema = z.object({
  bank_name:      z.string().min(1).optional(),
  account_name:   z.string().min(1).optional(),
  account_no:     z.string().min(1).optional(),
  currency:       z.string().optional(),
  account_type:   z.enum(['CURRENT', 'SAVINGS', 'FIXED_DEPOSIT', 'CREDIT_CARD', 'E_WALLET', 'OTHER']).optional(),
  current_status: z.string().optional(),
  is_active:      z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const account = await prisma.bankAccount.findFirst({
    where: { id, archived_at: null },
    include: {
      entity: { select: { id: true, entity_name: true } },
      import_batches: { orderBy: { imported_at: 'desc' }, take: 10 },
      _count: { select: { transactions: true } },
    },
  })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: account })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body      = await request.json()
    const validated = UpdateBankAccountSchema.parse(body)

    const before = await prisma.bankAccount.findFirst({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.bankAccount.update({ where: { id }, data: validated })

    await writeAuditLog({
      table_name:  'bank_accounts',
      record_id:   id,
      action:      'UPDATE',
      before_json: before,
      after_json:  updated,
      actor_id:    'system',
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const before = await prisma.bankAccount.findFirst({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const archived = await prisma.bankAccount.update({
    where: { id },
    data: { archived_at: new Date(), is_active: false },
  })

  await writeAuditLog({
    table_name:  'bank_accounts',
    record_id:   id,
    action:      'ARCHIVE',
    before_json: before,
    after_json:  archived,
    actor_id:    'system',
  })

  return NextResponse.json({ data: { archived: true } })
}
