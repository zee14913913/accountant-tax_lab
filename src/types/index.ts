// Re-export Prisma types + extend with UI-specific types
export type {
  User,
  Client,
  Entity,
  FilingProfile,
  Partner,
  PartnerLedgerEntry,
  BankAccount,
  AccountingCategory,
  TaxCategory,
  ChecklistTemplate,
  Counterparty,
  AuditLog,
} from '@prisma/client'

export type {
  UserRole,
  FlowType,
  ClientType,
  ClientStatus,
  EntityType,
  EInvoicePhase,
  ReportingFramework,
  FilingCategory,
  BankAccountType,
  ReportGroup,
  TaxDeductibleType,
  PartnerEntryType,
  AuditAction,
  CounterpartyType,
} from '@prisma/client'

// UI-specific types
export interface ChecklistItem {
  key: string
  label: string
  required: boolean
  status: 'PENDING' | 'DONE' | 'NA'
  completed_by?: string
  completed_at?: string
}

export interface ChecklistJson {
  flow_type: string
  items: ChecklistItem[]
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
