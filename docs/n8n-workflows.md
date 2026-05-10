# n8n Workflow Specifications
# Accountant Work Replacement System — All 7 Workflows

All workflows are self-hosted n8n. Base webhook URL: `N8N_WEBHOOK_BASE_URL` env var.
Authentication: All incoming webhooks verify `X-Webhook-Secret` header against `N8N_WEBHOOK_SECRET`.

---

## Workflow 1: Entity Created → Setup

**Trigger**: Webhook POST `/webhook/entity-created`
**Payload**: `{ entity_id, flow_type, entity_name, client_id }`

**Steps**:
1. HTTP Request → GET `/api/entities/{entity_id}` (fetch entity details)
2. Switch node by `flow_type`:
   - INDIVIDUAL_ONLY → Create FilingProfile: INCOME_TAX / Form BE / due April
   - INDIVIDUAL_BUSINESS → Create FilingProfiles: INCOME_TAX / Form B / due June + E_INVOICE (if applicable)
   - PARTNERSHIP → Create FilingProfiles: INCOME_TAX / Form P / due June + PAYROLL_PCB if employees
   - COMPANY → Create FilingProfiles: INCOME_TAX / Form C / 7 months after FY + E_INVOICE + ANNUAL_RETURN + AUDIT
3. HTTP Request → POST `/api/filing-profiles` (batch create)
4. HTTP Request → POST `/api/checklist-templates/apply` (create entity checklist from template matching flow_type)
5. Log completion

---

## Workflow 2: Bank Statement Import Parse

**Trigger**: Webhook POST `/webhook/import-parse`
**Payload**: `{ import_batch_id, entity_id, bank_account_id, source_file_url, source_type, parser_name }`

**Steps**:
1. HTTP Request → Download file from `source_file_url`
2. Switch node by `parser_name`:
   - `maybank_csv`, `cimb_csv`, `public_bank_csv`, `rhb_csv`, `hlb_csv`, `ambank_csv`, `ocbc_csv`, `uob_csv`
   - Each branch: parse CSV/PDF with bank-specific column mapping
3. For each parsed row:
   - Compute `source_hash` = sha256(entity_id + txn_date + amount + description)
   - Check deduplication via GET `/api/transactions?source_hash={hash}`
   - If not exists: POST `/api/transactions` (create transaction)
4. Auto risk-flag detection:
   - amount ≥ 10000 → HIGH_VALUE
   - amount % 1000 === 0 AND amount ≥ 500 → ROUND_NUMBER
   - description contains ["director", "DIRECTOR"] → DIRECTOR_RELATED
   - description contains ["related party", "RELATED", "intercompany"] → RELATED_PARTY
5. HTTP Request → PATCH `/api/imports/{import_batch_id}` (update status=COMPLETED, counts)
6. HTTP Request → POST `/api/webhooks/n8n/import-complete` (callback with results)

---

## Workflow 3: Missing Documents Daily Scan

**Trigger**: Cron `0 0 8 * * *` (08:00 MYT = 00:00 UTC)

**Steps**:
1. HTTP Request → GET `/api/transactions?document_status=REQUIRED_MISSING&limit=500`
2. For each transaction where `review_status != APPROVED`:
   - Check if `document_status = REQUIRED_MISSING` AND no SupportingDocument linked
   - Check if last scanned > 7 days
3. Create UnresolvedIssue records for new missing doc findings
4. HTTP Request → POST `/api/webhooks/n8n/missing-docs-scan` (callback with count)
5. (Optional) Send summary notification email via SMTP if count > 0

---

## Workflow 4: Monthly Close Readiness Check

**Trigger**: Webhook POST `/webhook/monthly-close-check`
**Payload**: `{ monthly_close_id, entity_id }`

**Steps**:
1. HTTP Request → GET `/api/monthly-close/{monthly_close_id}` (fetch with checklist)
2. Parse `checklist_json.items` — count required items not done
3. HTTP Request → GET `/api/transactions?entity_id={entity_id}&review_status=UNREVIEWED&month={period}`
4. HTTP Request → GET `/api/unresolved-issues?entity_id={entity_id}&status=OPEN&priority=HIGH`
5. Compute readiness score:
   - required_checklist_done: all required items complete?
   - unreviewed_txns: count
   - open_high_issues: count
   - is_ready: all 3 clear
6. HTTP Request → PATCH `/api/monthly-close/{monthly_close_id}` (update status if ready)
7. Return readiness report

---

## Workflow 5: P&L Generation

**Trigger**: Webhook POST `/webhook/pnl-generate`
**Payload**: `{ entity_id, period_start, period_end, basis, actor_id, month_close_id? }`

**Steps**:
1. HTTP Request → POST `/api/pnl/{entity_id}/generate` (the existing generate endpoint)
2. If `month_close_id` provided → PATCH `/api/monthly-close/{month_close_id}` with snapshot ID
3. Log completion with net_profit result

---

## Workflow 6: Tax Prep Generation

**Trigger**: Webhook POST `/webhook/tax-prep-generate`
**Payload**: `{ entity_id, assessment_year, flow_type }`

**Steps**:
1. HTTP Request → GET `/api/tax-prep/{entity_id}?assessment_year={year}` (fetch aggregated data)
2. Switch by `flow_type`:
   - INDIVIDUAL_ONLY:
     * Collect TaxReliefItems → compute chargeable income → apply progressive tax
     * Generate Form BE summary JSON
   - INDIVIDUAL_BUSINESS:
     * P&L adjusted income + CA schedule + personal reliefs
     * Generate Form B Schedule B summary JSON
   - PARTNERSHIP:
     * Partnership P&L + partner apportionment
     * Generate Form P summary JSON + per-partner allocation
   - COMPANY:
     * Adjusted accounting profit + add-backs + CA + losses b/f
     * Apply 17%/24% SME rate
     * Compute CP204 installment schedule (annual_tax / 12, due every 2 months)
     * Generate Form C summary JSON + CP204 schedule
3. HTTP Request → POST `/api/tax-adjustments` (save computed adjustments if not already saved)
4. Return computed tax summary

---

## Workflow 7: Auditor Pack Generation

**Trigger**: Webhook POST `/webhook/auditor-pack-generate`
**Payload**: `{ package_id, entity_id, flow_type, items_requested }`

**Steps**:
1. HTTP Request → GET `/api/auditor-pack/{package_id}` (fetch package details)
2. For each requested item_type (in order):

   **PNL_STATEMENT**:
   - GET `/api/pnl/{entity_id}?is_final=true` → latest snapshot
   - Format as structured JSON → callback with result

   **TRANSACTION_LIST**:
   - GET `/api/transactions?entity_id={entity_id}&period={start}-{end}&limit=5000`
   - Generate CSV data

   **DOCUMENT_MANIFEST**:
   - GET `/api/documents?entity_id={entity_id}&period={period}`
   - List all docs with verification_status

   **CHECKLIST_EXPORT**:
   - GET `/api/monthly-close?entity_id={entity_id}&status=CLOSED`
   - Export all closed periods' checklists

   **TAX_COMPUTATION**:
   - GET `/api/tax-prep/{entity_id}?assessment_year={year}`
   - Format tax computation output

   **UNRESOLVED_ISSUES_REPORT**:
   - GET `/api/unresolved-issues?entity_id={entity_id}`
   - Include ALL statuses with resolution notes

   **AUDIT_TRAIL**:
   - GET audit_logs for entity_id across all related tables

   **FIXED_ASSET_SCHEDULE**:
   - GET `/api/fixed-assets?entity_id={entity_id}` (if endpoint exists, else query directly)

   **PARTNER_LEDGER** (PARTNERSHIP only):
   - GET partner ledger entries for all partners

   **BALANCE_SHEET_SUMMARY** (COMPANY only):
   - Aggregate BS categories from transactions

3. For each item: POST `/api/webhooks/n8n/auditor-pack-complete` with result
4. After all items: check if package should auto-finalise

---

## Environment Variables Required

```bash
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com
N8N_WEBHOOK_SECRET=your-secret-key-here
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-app.com
```
