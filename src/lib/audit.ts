import { prisma } from './prisma'
import { AuditAction } from '@prisma/client'

export interface AuditLogParams {
  table_name: string
  record_id: string
  action: AuditAction
  before_json?: object | null
  after_json?: object | null
  actor_id: string
  ip_address?: string
}

export async function writeAuditLog(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        table_name: params.table_name,
        record_id: params.record_id,
        action: params.action,
        before_json: params.before_json ?? undefined,
        after_json: params.after_json ?? undefined,
        actor_id: params.actor_id,
        ip_address: params.ip_address,
      },
    })
  } catch (err) {
    // Audit log failure must not break the main operation
    console.error('[AuditLog] Failed to write audit log:', err)
  }
}
