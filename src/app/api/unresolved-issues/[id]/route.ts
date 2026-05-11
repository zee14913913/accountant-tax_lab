import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const PatchIssueSchema = z.object({
  status:      z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WAIVED', 'ESCALATED']).optional(),
  assigned_to: z.string().optional(),
  resolution:  z.string().optional(),
  resolved_by: z.string().optional(),
  actor_id:    z.string().optional(),
  priority:    z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  title:       z.string().optional(),
  description: z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/unresolved-issues/[id]
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const issue = await prisma.unresolvedIssue.findUnique({
    where: { id: (await params).id },
    include: {
      entity: {
        select: { entity_name: true, flow_type: true },
      },
    },
  })

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  return NextResponse.json({ data: issue })
}

// ---------------------------------------------------------------------------
// PATCH /api/unresolved-issues/[id]
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body      = await request.json()
    const validated = PatchIssueSchema.parse(body)

    const existing = await prisma.unresolvedIssue.findUnique({ where: { id: (await params).id } })
    if (!existing) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (validated.status      !== undefined) updateData.status      = validated.status
    if (validated.assigned_to !== undefined) updateData.assigned_to = validated.assigned_to
    if (validated.resolution  !== undefined) updateData.resolution  = validated.resolution
    if (validated.priority    !== undefined) updateData.priority    = validated.priority
    if (validated.title       !== undefined) updateData.title       = validated.title
    if (validated.description !== undefined) updateData.description = validated.description

    if (validated.status === 'RESOLVED') {
      updateData.resolved_at = new Date()
      updateData.resolved_by = validated.resolved_by ?? validated.actor_id ?? 'system'
    }

    const updated = await prisma.unresolvedIssue.update({
      where: { id: (await params).id },
      data:  updateData,
      include: {
        entity: { select: { entity_name: true, flow_type: true } },
      },
    })

    await writeAuditLog({
      table_name: 'unresolved_issues',
      record_id:  (await params).id,
      action:     'UPDATE',
      before_json: existing,
      after_json:  updateData,
      actor_id:    validated.actor_id ?? 'system',
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[unresolved-issues PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
