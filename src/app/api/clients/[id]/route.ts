import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateClientSchema = z.object({
  legal_name:        z.string().min(1).optional(),
  display_name:      z.string().optional(),
  registration_no:   z.string().optional(),
  identification_no: z.string().optional(),
  tax_no:            z.string().optional(),
  phone:             z.string().optional(),
  email:             z.string().email().optional(),
  status:            z.enum(['ACTIVE', 'INACTIVE']).optional(),
  assigned_owner_id: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await prisma.client.findFirst({
    where:   { id: (await params).id, archived_at: null },
    include: {
      entities: {
        where:   { archived_at: null },
        include: { filing_profiles: { where: { is_active: true } } },
      },
      counterparties:  { where: { is_active: true } },
      assigned_owner:  { select: { id: true, name: true, email: true } },
    },
  })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  return NextResponse.json({ data: client })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body      = await request.json()
    const validated = UpdateClientSchema.parse(body)

    const before = await prisma.client.findFirst({ where: { id: (await params).id } })
    if (!before) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const updated = await prisma.client.update({
      where: { id: (await params).id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data:  validated as any,
    })

    await writeAuditLog({
      table_name:  'clients',
      record_id:   (await params).id,
      action:      'UPDATE',
      before_json: before,
      after_json:  updated,
      actor_id:    'system', // Replace with actual session user
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Archive (soft delete) — not hard delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const before = await prisma.client.findFirst({ where: { id: (await params).id } })
  if (!before) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const archived = await prisma.client.update({
    where: { id: (await params).id },
    data: {
      archived_at: new Date(),
      archived_by: 'system',
      status:      'ARCHIVED',
    },
  })

  await writeAuditLog({
    table_name:  'clients',
    record_id:   (await params).id,
    action:      'ARCHIVE',
    before_json: before,
    after_json:  archived,
    actor_id:    'system',
  })

  return NextResponse.json({ data: { archived: true } })
}
