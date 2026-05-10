# Accountant Work Replacement System

Malaysia-focused multi-entity accounting automation system — replaces manual accountant workflows with a structured, audit-ready platform.

## Tech Stack

- **Framework**: Next.js 15.x (App Router)
- **Database**: PostgreSQL 16.x via Prisma 6.x
- **Auth**: NextAuth.js v5
- **Styling**: Tailwind CSS 3.x (black/white/grey design system, Avenir Next font)
- **Automation**: n8n (self-hosted, 7 workflows)
- **Runtime**: Node.js 20 LTS

## Supported Entity Types

| Flow Type | Form | Due Date |
|-----------|------|----------|
| `INDIVIDUAL_ONLY` | Form BE | 30 April |
| `INDIVIDUAL_BUSINESS` | Form B | 30 June |
| `PARTNERSHIP` | Form P | 30 June |
| `COMPANY` | Form C + CP204 | 7 months after FY end |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env
# Fill in DATABASE_URL, NEXTAUTH_SECRET, N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_SECRET

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Seed reference data
npx prisma db seed

# 5. Start development server
npm run dev
```

## Database Seed Data

- 72 accounting categories (REV / COS / OPX / OTH / FIN / TAX / BS asset/liability/equity)
- 27 LHDN Malaysia tax categories
- 8 checklist templates (4 flow types × TAX_PREP + MONTHLY_CLOSE)

## System Architecture

```
Phase 1  Foundation     clients, entities, filing_profiles, partners, bank_accounts, categories
Phase 2  Import         import_batches, transactions, 8-bank CSV/PDF parsers, n8n Workflow 2
Phase 3  Transactions   classify, counterparties, risk flags, bulk ops
Phase 4  Documents      supporting_documents, OCR pipeline (n8n Workflow), missing-docs scan
Phase 5  Workbench      accounting-assistant, entity checklist, unresolved_issues, fixed_assets
Phase 6  Monthly Close  monthly_close, pnl_snapshots, P&L generation (flow_type-aware)
Phase 7  Tax Prep       tax_adjustments, tax-prep workbench (Form BE/B/P/C + CP204)
Phase 8  Auditor Pack   auditor_packages, pack export, n8n Workflow 7
```

## n8n Workflows

See `docs/n8n-workflows.md` for full specifications of all 7 workflows.

## Malaysia 2026 Tax Compliance

- SME corporate tax: 17% (first RM150,000) / 24% (remainder) — paid-up capital ≤ RM2.5M
- Individual progressive tax: 0%–30%
- CP204 installments: every 2 months
- e-Invoice Phase 3 (RM500K–RM25M turnover): mandatory from July 2025
- SST: Service Tax 8% (select 6%), Sales Tax for manufacturers

## Key Design Rules

- No hard deletes — all core data uses `archived_at` soft delete
- Every significant action writes an `AuditLog` entry
- All filing/tax references validated against 2026 Malaysia official rules
- UI: black/white/grey only, Avenir Next font, tabular-nums for all amounts
