// GET /api/pnl/[entityId] — List all PnlSnapshots for an entity
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const is_final = searchParams.get('is_final')
    const limit = parseInt(searchParams.get('limit') ?? '24')
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const where: Record<string, unknown> = { entity_id: params.entityId }
    if (is_final === 'true') where.is_final = true
    if (is_final === 'false') where.is_final = false

    const [snapshots, total] = await Promise.all([
      prisma.pnlSnapshot.findMany({
        where,
        orderBy: [{ period_end: 'desc' }, { generated_at: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          monthly_close: { select: { id: true, status: true } },
        },
      }),
      prisma.pnlSnapshot.count({ where }),
    ])

    return NextResponse.json({
      data: snapshots,
      meta: { total, limit, offset },
    })
  } catch (err) {
    console.error('[pnl/[entityId] GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
