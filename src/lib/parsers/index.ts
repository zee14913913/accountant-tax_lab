/**
 * Parser Registry — Accountant Work Replacement System
 *
 * This module defines the interface for bank statement parsers and
 * provides a registry to select the correct parser by bank name.
 *
 * IMPORTANT: Actual PDF/CSV parsing is performed by n8n workflows
 * to keep the Next.js server lean. This module provides:
 * 1. The standard ParsedTransaction interface
 * 2. The parser registry for n8n to reference
 * 3. Manual CSV import utility for client-side pre-processing
 */

export interface ParsedTransaction {
  txn_date:      string    // ISO 8601 date
  posting_date?: string
  description:   string
  raw_text?:     string
  reference_no?: string
  direction:     'CREDIT' | 'DEBIT'
  amount:        number    // Always positive
  balance_after?: number
  source_hash?:  string   // SHA-256 of key fields for dedup
}

export interface ParserResult {
  parser_name:     string
  parser_version:  string
  transactions:    ParsedTransaction[]
  unparsed_count:  number
  parse_errors:    string[]
  source_transaction_count: number
}

/**
 * Supported Malaysian bank statement formats.
 * n8n selects the parser node based on these identifiers.
 */
export const PARSER_REGISTRY: Record<string, { name: string; version: string; formats: string[] }> = {
  MAYBANK:       { name: 'maybank-pdf-parser',     version: '1.0', formats: ['PDF', 'CSV'] },
  CIMB:          { name: 'cimb-pdf-parser',        version: '1.0', formats: ['PDF', 'CSV'] },
  PUBLIC_BANK:   { name: 'publicbank-pdf-parser',  version: '1.0', formats: ['PDF', 'CSV'] },
  RHB:           { name: 'rhb-pdf-parser',         version: '1.0', formats: ['PDF', 'CSV'] },
  HLB:           { name: 'hlb-pdf-parser',         version: '1.0', formats: ['PDF'] },
  AMBANK:        { name: 'ambank-pdf-parser',       version: '1.0', formats: ['PDF', 'CSV'] },
  OCBC:          { name: 'ocbc-pdf-parser',        version: '1.0', formats: ['PDF', 'CSV'] },
  UOB:           { name: 'uob-pdf-parser',         version: '1.0', formats: ['PDF', 'CSV'] },
  STANDARD_CSV:  { name: 'standard-csv-parser',   version: '1.0', formats: ['CSV'] },  // Generic CSV fallback
}

/**
 * Detect bank from bank_name string (case-insensitive).
 */
export function detectBankParser(bankName: string): string {
  const upper = bankName.toUpperCase()
  if (upper.includes('MAYBANK') || upper.includes('MBB'))       return 'MAYBANK'
  if (upper.includes('CIMB'))                                    return 'CIMB'
  if (upper.includes('PUBLIC') || upper.includes('PBB'))         return 'PUBLIC_BANK'
  if (upper.includes('RHB'))                                     return 'RHB'
  if (upper.includes('HONG LEONG') || upper.includes('HLB'))     return 'HLB'
  if (upper.includes('AMBANK') || upper.includes('AMB'))         return 'AMBANK'
  if (upper.includes('OCBC'))                                    return 'OCBC'
  if (upper.includes('UOB'))                                     return 'UOB'
  return 'STANDARD_CSV'
}

/**
 * Standard CSV column mapping for generic CSV imports.
 * Users can upload a CSV that follows this format.
 */
export const STANDARD_CSV_COLUMNS = {
  txn_date:     'Date',           // Required
  description:  'Description',    // Required
  debit:        'Debit',          // One of debit/credit must be present
  credit:       'Credit',         // One of debit/credit must be present
  amount:       'Amount',         // Alternative: single amount column with +/-
  balance:      'Balance',        // Optional
  reference:    'Reference',      // Optional
}

/**
 * Generate source_hash for deduplication.
 * Uses a combination of txn_date + amount + description.
 * Note: actual SHA-256 hashing is done server-side.
 */
export function buildHashInput(txn: Omit<ParsedTransaction, 'source_hash'>): string {
  return `${txn.txn_date}|${txn.direction}|${Math.abs(txn.amount).toFixed(2)}|${txn.description.slice(0, 50)}`
}
