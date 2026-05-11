'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NA'
type FlowType   = 'INDIVIDUAL_ONLY' | 'INDIVIDUAL_BUSINESS' | 'PARTNERSHIP' | 'COMPANY'

interface ChecklistItem {
  id:          string
  label:       string
  description: string
}

interface ChecklistSection {
  id:    string
  title: string
  items: ChecklistItem[]
}

interface ItemState {
  status: ItemStatus
  notes:  string
}

type ChecklistState = Record<string, ItemState>

interface EntityData {
  id:                 string
  entity_name:        string
  entity_type:        string
  flow_type:          FlowType
  financial_year_end: string | null
  tax_reference_no:   string | null
  client: {
    legal_name:   string
    display_name: string | null
  }
}

interface Props {
  entity: EntityData
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FLOW_FORM: Record<FlowType, string> = {
  INDIVIDUAL_ONLY:     'Form BE',
  INDIVIDUAL_BUSINESS: 'Form B',
  PARTNERSHIP:         'Form P',
  COMPANY:             'Form C',
}

const FLOW_TITLE: Record<FlowType, string> = {
  INDIVIDUAL_ONLY:     'Form BE — Resident Individual (No Business Income)',
  INDIVIDUAL_BUSINESS: 'Form B — Resident Individual (Carrying On Business)',
  PARTNERSHIP:         'Form P — Partnership Tax Return',
  COMPANY:             'Form C — Company Tax Return',
}

const FLOW_DEADLINE: Record<FlowType, { paper: string; efiling: string }> = {
  INDIVIDUAL_ONLY:     { paper: '30 April 2026',  efiling: '15 May 2026' },
  INDIVIDUAL_BUSINESS: { paper: '30 June 2026',   efiling: '15 July 2026' },
  PARTNERSHIP:         { paper: '30 June 2026',   efiling: '15 July 2026' },
  COMPANY:             { paper: 'Within 7 months from financial year end', efiling: '8 months from FYE' },
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  NA:          'N/A',
}

const STATUS_CYCLE: ItemStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NA']

// ─── Checklists by flow type ──────────────────────────────────────────────────

const CHECKLIST_INDIVIDUAL_ONLY: ChecklistSection[] = [
  {
    id:    'part-a',
    title: 'PART A — Personal Particulars',
    items: [
      { id: 'a1',  label: 'Full name (as per IC)',             description: 'Must match NRIC exactly as used for e-Filing login.' },
      { id: 'a2',  label: 'Income Tax No. (SG/OG prefix)',     description: 'Confirm correct prefix: SG for salaried, OG for others.' },
      { id: 'a3',  label: 'Identity Card No. (NRIC)',          description: 'New format NRIC (12 digits).' },
      { id: 'a4',  label: 'Date of birth',                     description: 'Verify against NRIC.' },
      { id: 'a5',  label: 'Nationality',                       description: 'Malaysian citizen or PR status.' },
      { id: 'a6',  label: 'Residential address',               description: 'Current residential address for correspondence.' },
      { id: 'a7',  label: 'Telephone number',                  description: 'Mobile or home number for LHDN contact.' },
      { id: 'a8',  label: 'Email address',                     description: 'Registered email for MyTax / e-Filing notifications.' },
      { id: 'a9',  label: 'Marital status',                    description: 'Single / Married / Widowed / Divorced.' },
      { id: 'a10', label: 'Spouse name & IC no. (if married)', description: 'Required to claim spouse relief and/or combined assessment.' },
      { id: 'a11', label: 'Spouse income tax no.',             description: 'Required if spouse files separately.' },
      { id: 'a12', label: 'Number of children',                description: 'All children including disabled, studying abroad, etc.' },
    ],
  },
  {
    id:    'part-b',
    title: 'PART B — Statutory Income',
    items: [
      { id: 'b1',  label: 'B1: Employment income (Form EA)',  description: 'Gross salary, allowances, bonuses. Obtain Form EA from all employers.' },
      { id: 'b2',  label: 'B2: Rent from real property',     description: 'Net rental income after allowable deductions (quit rent, assessment, repairs).' },
      { id: 'b3',  label: 'B3: Royalties',                   description: 'From publications, patents, compositions, etc.' },
      { id: 'b4',  label: 'B4: Interest income',             description: 'Fixed deposits, bond interest. Note: savings interest may be exempt.' },
      { id: 'b5',  label: 'B5: Discounts',                   description: 'Trade discounts or preferential pricing benefits.' },
      { id: 'b6',  label: 'B6: Pension',                     description: 'Pension payments received.' },
      { id: 'b7',  label: 'B7: Annuities',                   description: 'Periodic annuity payments.' },
      { id: 'b8',  label: 'B8: Periodical payments',         description: 'Regular income payments not classified elsewhere.' },
      { id: 'b9',  label: 'B9: Gains from disposal of assets', description: 'Not subject to income tax if RPGT applies separately.' },
      { id: 'b10', label: 'B10: Other income',               description: 'Any other taxable income not listed above.' },
    ],
  },
  {
    id:    'part-c',
    title: 'PART C — Total Income & Deductions',
    items: [
      { id: 'c1', label: 'C1: Approved donations',      description: 'Max RM20,000 or 10% of aggregate income. Must be to approved institutions.' },
      { id: 'c2', label: 'C2: Loss brought forward',    description: 'Any prior year approved losses (rare for individuals without business).' },
    ],
  },
  {
    id:    'part-d',
    title: 'PART D — Personal Reliefs (YA 2025)',
    items: [
      { id: 'd1',  label: 'Individual self',                              description: 'RM9,000 — automatic, no documentation required.' },
      { id: 'd2',  label: 'Parents medical/dental (certified)',           description: 'Up to RM8,000; medical examination limit RM1,000. Requires certified receipts.' },
      { id: 'd3',  label: 'Basic supporting equipment (disabled)',        description: 'Up to RM6,000. For self, spouse, child, or parent who is disabled.' },
      { id: 'd4',  label: 'Disabled self',                               description: 'Up to RM7,000 additional relief if individual is registered OKU.' },
      { id: 'd5',  label: 'Education fees (self)',                        description: 'Up to RM7,000; upskilling/self-enhancement courses max RM2,000.' },
      { id: 'd6',  label: 'Medical expenses (serious disease/fertility/vaccination/dental)', description: 'Up to RM10,000 total; vaccination sub-limit RM1,000, dental sub-limit RM1,000.' },
      { id: 'd7',  label: 'Health examination & monitoring',              description: 'Up to RM10,000 (medical exam sub-limit RM1,000). Inclusive with d6 limit.' },
      { id: 'd8',  label: 'Child intellectual disability/early intervention', description: 'Up to RM10,000 total; sub-limit RM6,000 for early intervention.' },
      { id: 'd9',  label: 'Lifestyle (books/computer/internet/skills)',   description: 'Up to RM2,500 — purchase receipts required.' },
      { id: 'd10', label: 'Lifestyle additional (sports)',               description: 'Up to RM1,000 — sports equipment, gym membership, competitions.' },
      { id: 'd11', label: 'Breastfeeding equipment',                     description: 'Up to RM1,000 — for child aged 2 or below.' },
      { id: 'd12', label: 'Childcare fees (child 0–6)',                  description: 'Up to RM3,000 — registered childcare centres.' },
      { id: 'd13', label: 'Net savings in SSPN',                         description: 'Up to RM8,000 — net contribution after withdrawals.' },
      { id: 'd14', label: 'Spouse (no income/disabled)',                 description: 'Up to RM4,000 — spouse with no income.' },
      { id: 'd15', label: 'Disabled spouse (additional)',                description: 'Up to RM3,500 additional — spouse registered as OKU.' },
      { id: 'd16', label: 'Each child below 18',                        description: 'RM2,000 per child — unmarried child below 18.' },
      { id: 'd17', label: 'Each child 18+ (full-time education)',        description: 'RM2,000 per child — university/college/A-levels.' },
      { id: 'd18', label: 'Disabled child',                             description: 'RM6,000 additional; if studying, RM8,000 additional.' },
      { id: 'd19', label: 'Life insurance & EPF',                       description: 'Up to RM7,000 combined; life insurance sub-limit RM3,000.' },
      { id: 'd20', label: 'Private retirement scheme (PRS)',             description: 'Up to RM3,000.' },
      { id: 'd21', label: 'Education & medical insurance',              description: 'Up to RM3,000.' },
      { id: 'd22', label: 'SOCSO contribution',                         description: 'Up to RM350.' },
      { id: 'd23', label: 'EV charging facility',                       description: 'Up to RM2,500 — purchase/installation of EV charger.' },
      { id: 'd24', label: 'Domestic tourism',                           description: 'Up to RM1,000 — local hotel/tour package receipts.' },
      { id: 'd25', label: 'Childcare centre/kindergarten fees',         description: 'Up to RM3,000 — registered centres only.' },
    ],
  },
  {
    id:    'part-e',
    title: 'PART E — Rebates',
    items: [
      { id: 'e1', label: 'Individual rebate',   description: 'RM400 — only if chargeable income ≤ RM35,000.' },
      { id: 'e2', label: 'Spouse rebate',       description: 'RM400 — if spouse has no income and chargeable income ≤ RM35,000.' },
      { id: 'e3', label: 'Zakat / fitrah',      description: 'Capped at tax payable. Requires receipt from LHDN-approved body.' },
    ],
  },
  {
    id:    'part-f',
    title: 'PART F — Tax Computation Summary',
    items: [
      { id: 'f1', label: 'Aggregate income computed',                  description: 'Sum of all statutory income from Part B.' },
      { id: 'f2', label: 'Less: Approved donations confirmed',         description: 'Deduct C1 from aggregate income.' },
      { id: 'f3', label: 'Total income confirmed',                     description: 'Aggregate income less donations.' },
      { id: 'f4', label: 'Less: Personal reliefs totalled',           description: 'Total all Part D reliefs.' },
      { id: 'f5', label: 'Chargeable income calculated',              description: 'Total income minus reliefs.' },
      { id: 'f6', label: 'Tax on chargeable income (rate schedule)',  description: 'Progressive rates 0%–30% applied.' },
      { id: 'f7', label: 'Less: Rebates applied',                     description: 'Individual/spouse rebate, zakat deducted.' },
      { id: 'f8', label: 'Tax payable determined',                    description: 'Tax after rebates.' },
      { id: 'f9', label: 'Less: MTD/PCB already deducted',           description: 'Monthly Tax Deduction from employer(s).' },
      { id: 'f10', label: 'Balance payable / refund confirmed',       description: 'Final amount to pay or refund due.' },
    ],
  },
  {
    id:    'docs',
    title: 'Supporting Documents Checklist',
    items: [
      { id: 'doc1', label: 'Form EA from employer(s)',             description: 'Issued by employer by 28 Feb. Obtain from all employers for the year.' },
      { id: 'doc2', label: 'EPF statement',                        description: 'Annual EPF contribution statement from KWSP.' },
      { id: 'doc3', label: 'SOCSO statement',                      description: 'Annual SOCSO contribution statement.' },
      { id: 'doc4', label: 'Life insurance premium receipt',       description: 'Annual premium receipt from insurer.' },
      { id: 'doc5', label: 'Medical receipts (relief claims)',      description: 'All medical receipts supporting Part D claims.' },
      { id: 'doc6', label: 'Education fee receipts',               description: 'University / college fee receipts for self or children.' },
      { id: 'doc7', label: 'Loan interest statement',              description: 'If rental income claimed — mortgage interest statement.' },
      { id: 'doc8', label: 'Property rental agreement',            description: 'If rental income declared in B2.' },
      { id: 'doc9', label: 'Bank interest statement',              description: 'Fixed deposit or bond interest confirmation.' },
    ],
  },
]

const CHECKLIST_INDIVIDUAL_BUSINESS: ChecklistSection[] = [
  {
    id:    'part-a',
    title: 'PART A — Personal Particulars',
    items: [
      { id: 'a1',  label: 'Full name (as per IC)',             description: 'Must match NRIC exactly.' },
      { id: 'a2',  label: 'Income Tax No. (SG/OG prefix)',     description: 'OG prefix for individuals with business income.' },
      { id: 'a3',  label: 'Identity Card No. (NRIC)',          description: '12-digit NRIC.' },
      { id: 'a4',  label: 'Date of birth',                     description: 'Verify against NRIC.' },
      { id: 'a5',  label: 'Nationality',                       description: 'Malaysian citizen or PR status.' },
      { id: 'a6',  label: 'Residential address',               description: 'Current residential address.' },
      { id: 'a7',  label: 'Telephone number',                  description: 'Mobile or home number.' },
      { id: 'a8',  label: 'Email address',                     description: 'Email for MyTax notifications.' },
      { id: 'a9',  label: 'Marital status',                    description: 'Single / Married / Widowed / Divorced.' },
      { id: 'a10', label: 'Spouse name & IC no. (if married)', description: 'Required if claiming spouse relief.' },
      { id: 'a11', label: 'Spouse income tax no.',             description: 'Required if spouse files separately.' },
      { id: 'a12', label: 'Number of children',                description: 'All children for relief purposes.' },
    ],
  },
  {
    id:    'part-b',
    title: 'PART B — Business Income',
    items: [
      { id: 'b1a', label: 'B1: Adjusted income from business',     description: 'Net profit per accounts, add back disallowed expenses.' },
      { id: 'b1b', label: 'B1: Less — Capital allowances',         description: 'IA + AA on qualifying fixed assets.' },
      { id: 'b1c', label: 'B1: Statutory income from business',    description: 'Adjusted income less capital allowances.' },
      { id: 'b2',  label: 'B2: Employment income (Form EA)',        description: 'If also employed; from EA Form.' },
      { id: 'b3',  label: 'B3: Rent from real property',           description: 'Net rental income.' },
      { id: 'b4',  label: 'B4–B10: Royalties / Interest / Other', description: 'All other statutory income sources.' },
    ],
  },
  {
    id:    'part-c',
    title: 'PART C — Business Expenses Summary',
    items: [
      { id: 'c1',  label: 'Gross business revenue',               description: 'Total sales/revenue per P&L.' },
      { id: 'c2',  label: 'Less: Cost of goods sold',             description: 'Direct costs attributable to revenue.' },
      { id: 'c3',  label: 'Gross profit confirmed',               description: 'Revenue minus COGS.' },
      { id: 'c4',  label: 'Staff salaries & EPF',                 description: 'All staff costs including EPF contributions.' },
      { id: 'c5',  label: 'Rental of premises',                   description: 'Office/shop rental — obtain receipts/tenancy agreement.' },
      { id: 'c6',  label: 'Utilities',                            description: 'Electricity, water, internet, telephone.' },
      { id: 'c7',  label: 'Professional fees',                    description: 'Legal, accounting, consulting fees.' },
      { id: 'c8',  label: 'Marketing & advertising',              description: 'Advertising spend, promotions.' },
      { id: 'c9',  label: 'Motor vehicle expenses',               description: 'Fuel, maintenance — private use portion disallowed.' },
      { id: 'c10', label: 'Travel & accommodation',               description: 'Business travel only; personal travel disallowed.' },
      { id: 'c11', label: 'Repairs & maintenance',                description: 'Revenue repairs allowed; capital improvements → CA.' },
      { id: 'c12', label: 'Office supplies & stationery',         description: 'Stationery, postage, small consumables.' },
      { id: 'c13', label: 'Other allowable expenses',             description: 'All other S33 ITA 1967 wholly & exclusively incurred.' },
      { id: 'c14', label: 'Add back: Disallowed expenses',        description: 'Entertainment (50%), personal, penalties, depreciation.' },
      { id: 'c15', label: 'Adjusted income from business',        description: 'Net profit after tax adjustments.' },
    ],
  },
  {
    id:    'part-d',
    title: 'PART D — Capital Allowances',
    items: [
      { id: 'd1', label: 'Initial allowance (20%)',                description: 'Year of acquisition — 20% on qualifying cost.' },
      { id: 'd2', label: 'Annual allowance (by asset category)',  description: 'Motor vehicle 20%, office equipment 10%, ICT 20–40%.' },
      { id: 'd3', label: 'Accelerated CA (if applicable)',        description: 'High-tech / green / automation equipment may qualify.' },
      { id: 'd4', label: 'Fixed asset register completed',        description: 'All assets listed with acquisition cost and date.' },
    ],
  },
  {
    id:    'part-e',
    title: 'PART E — Personal Reliefs (YA 2025)',
    items: [
      { id: 'e1',  label: 'Individual self — RM9,000',                     description: 'Automatic relief.' },
      { id: 'e2',  label: 'Parents medical/dental — up to RM8,000',        description: 'Certified receipts required.' },
      { id: 'e3',  label: 'Disabled self — up to RM7,000',                 description: 'OKU registration required.' },
      { id: 'e4',  label: 'Education fees (self) — up to RM7,000',         description: 'Upskilling max RM2,000 sub-limit.' },
      { id: 'e5',  label: 'Medical expenses — up to RM10,000',             description: 'Serious disease, fertility, vaccination (RM1k), dental (RM1k).' },
      { id: 'e6',  label: 'Lifestyle — up to RM2,500',                     description: 'Books, computer, internet, skills.' },
      { id: 'e7',  label: 'Lifestyle sports — up to RM1,000',              description: 'Sports equipment, gym, competitions.' },
      { id: 'e8',  label: 'SSPN net savings — up to RM8,000',              description: 'Net contributions to SSPN.' },
      { id: 'e9',  label: 'Spouse — up to RM4,000',                        description: 'Spouse with no income.' },
      { id: 'e10', label: 'Children reliefs',                              description: 'RM2,000 per child below 18; RM2,000 per child in full-time education.' },
      { id: 'e11', label: 'Life insurance & EPF — up to RM7,000',         description: 'Life insurance sub-limit RM3,000.' },
      { id: 'e12', label: 'PRS — up to RM3,000',                           description: 'Private Retirement Scheme contribution.' },
      { id: 'e13', label: 'Education & medical insurance — up to RM3,000', description: 'Premium receipts required.' },
      { id: 'e14', label: 'SOCSO — up to RM350',                           description: 'SOCSO contribution statement.' },
      { id: 'e15', label: 'EV charging facility — up to RM2,500',          description: 'Purchase/installation receipts.' },
    ],
  },
  {
    id:    'docs',
    title: 'Supporting Documents',
    items: [
      { id: 'doc1', label: 'Business registration certificate (SSM)',  description: 'Current SSM extract or annual return.' },
      { id: 'doc2', label: 'Bank statements (all business accounts)',  description: 'Full year statements for all accounts.' },
      { id: 'doc3', label: 'Sales invoices / receipts issued',         description: 'All income documentation for the year.' },
      { id: 'doc4', label: 'Purchase invoices / expense receipts',     description: 'All expense documentation.' },
      { id: 'doc5', label: 'EPF/SOCSO contribution statements',        description: 'Annual statements for all staff.' },
      { id: 'doc6', label: 'Fixed asset purchase documents',           description: 'Invoices/receipts for all capital purchases.' },
      { id: 'doc7', label: 'Form EA (if also employed)',               description: 'From all employers during the year.' },
      { id: 'doc8', label: 'Stock count / inventory records',          description: 'Year-end stocktake for COGS calculation.' },
    ],
  },
]

const CHECKLIST_PARTNERSHIP: ChecklistSection[] = [
  {
    id:    'part-a',
    title: 'PART A — Partnership Details',
    items: [
      { id: 'a1', label: 'Partnership name (as registered with SSM)',        description: 'Exact name per SSM certificate.' },
      { id: 'a2', label: 'Tax Reference No. (D prefix)',                     description: 'Partnership tax number — D prefix.' },
      { id: 'a3', label: 'Business Registration No. (SSM)',                  description: 'Obtain current SSM extract.' },
      { id: 'a4', label: 'MSIC Code',                                        description: 'Malaysia Standard Industrial Classification code.' },
      { id: 'a5', label: 'Business address',                                 description: 'Registered business premises address.' },
      { id: 'a6', label: 'Contact details',                                  description: 'Phone and email for LHDN correspondence.' },
      { id: 'a7', label: 'Type of business',                                 description: 'Nature of business activity.' },
      { id: 'a8', label: 'Date of commencement',                             description: 'Business start date per SSM.' },
      { id: 'a9', label: 'Accounting period (financial year end)',           description: 'Confirm FYE matches Form P period.' },
    ],
  },
  {
    id:    'part-b',
    title: 'PART B — Income from Business',
    items: [
      { id: 'b1', label: 'Gross income / revenue',              description: 'Total sales per audited / reviewed accounts.' },
      { id: 'b2', label: 'Less: Direct costs / COGS',           description: 'Direct costs attributable to revenue.' },
      { id: 'b3', label: 'Gross profit confirmed',              description: 'Revenue minus COGS.' },
      { id: 'b4', label: 'Allowable business expenses itemised', description: 'Staff costs, rent, utilities, professional fees, etc.' },
      { id: 'b5', label: 'Net profit before adjustments',       description: 'Gross profit minus allowable expenses.' },
      { id: 'b6', label: 'Add back: Non-allowable expenses',    description: 'Entertainment 50%, personal expenses, depreciation, penalties.' },
      { id: 'b7', label: 'Adjusted income from business',       description: 'Net profit after tax adjustments.' },
      { id: 'b8', label: 'Less: Capital allowances',            description: 'IA + AA on qualifying fixed assets.' },
      { id: 'b9', label: 'Statutory income confirmed',          description: 'Adjusted income less capital allowances.' },
    ],
  },
  {
    id:    'part-c',
    title: 'PART C — Partners\' Particulars & Profit Apportionment',
    items: [
      { id: 'c1', label: 'All partner names listed',                          description: 'Full names as per IC/passport.' },
      { id: 'c2', label: 'NRIC / Passport no. for each partner',             description: 'Verify against partnership agreement.' },
      { id: 'c3', label: 'Tax Identification No. (TIN) for each partner',    description: 'Each partner\'s personal TIN.' },
      { id: 'c4', label: 'Capital contribution (RM) per partner',            description: 'Per partnership agreement and capital account.' },
      { id: 'c5', label: 'Profit share percentage (%) confirmed',            description: 'Must total 100%. Per partnership deed.' },
      { id: 'c6', label: 'Share of statutory income calculated',             description: 'Statutory income × each partner\'s profit share %.' },
      { id: 'c7', label: 'Each partner notified of their income share',       description: 'To declare in personal Form B / Form BE.' },
    ],
  },
  {
    id:    'part-d',
    title: 'PART D — Supporting Schedules',
    items: [
      { id: 'd1', label: 'Balance sheet as at year end',          description: 'Signed by managing partner or auditor.' },
      { id: 'd2', label: 'Profit & loss statement',               description: 'Full P&L for the accounting period.' },
      { id: 'd3', label: 'Capital accounts for each partner',     description: 'Opening balance, contributions, drawings, closing.' },
      { id: 'd4', label: 'Schedule of fixed assets & CA',         description: 'Assets with IA, AA, and residual value.' },
      { id: 'd5', label: 'Schedule of disallowed expenses',       description: 'Detailed breakdown of add-back items.' },
    ],
  },
  {
    id:    'docs',
    title: 'Supporting Documents',
    items: [
      { id: 'doc1', label: 'Partnership agreement (deed)',       description: 'Signed original or certified copy.' },
      { id: 'doc2', label: 'SSM registration certificate',      description: 'Current valid certificate.' },
      { id: 'doc3', label: 'All bank statements',               description: 'Full year for all partnership accounts.' },
      { id: 'doc4', label: 'Sales invoices & receipts',         description: 'All income records.' },
      { id: 'doc5', label: 'Purchase invoices',                 description: 'All expense records.' },
      { id: 'doc6', label: 'Fixed asset documents',             description: 'Acquisition invoices for all capital assets.' },
      { id: 'doc7', label: 'EPF/SOCSO statements',              description: 'Annual statements.' },
      { id: 'doc8', label: 'Previous year Form P',              description: 'For comparison and loss b/f verification.' },
    ],
  },
]

const CHECKLIST_COMPANY: ChecklistSection[] = [
  {
    id:    'part-a',
    title: 'PART A — Company Particulars',
    items: [
      { id: 'a1',  label: 'Company name (as per SSM)',              description: 'Exact legal name.' },
      { id: 'a2',  label: 'Income Tax No. (C prefix)',              description: 'Company tax reference — C prefix.' },
      { id: 'a3',  label: 'Company Registration No. (SSM)',         description: 'Current SSM extract / Form 9.' },
      { id: 'a4',  label: 'Tax Identification No. (TIN)',           description: 'Mandatory for e-Invoice compliance.' },
      { id: 'a5',  label: 'Business address',                       description: 'Registered business address.' },
      { id: 'a6',  label: 'Correspondence address',                 description: 'Address for LHDN mail.' },
      { id: 'a7',  label: 'MSIC Code',                              description: 'Malaysia Standard Industrial Classification.' },
      { id: 'a8',  label: 'Type of company (Sdn Bhd / Bhd / etc.)', description: 'As per SSM registration.' },
      { id: 'a9',  label: 'Financial year end',                     description: 'Confirm correct FYE on Form C.' },
      { id: 'a10', label: 'Date of incorporation',                  description: 'Per SSM Form 9.' },
      { id: 'a11', label: 'Paid-up capital (RM)',                   description: 'Current paid-up capital — affects SME rate eligibility.' },
      { id: 'a12', label: 'Principal activities',                   description: 'Per M&A / SSM — must match tax computation.' },
    ],
  },
  {
    id:    'part-b',
    title: 'PART B — Income',
    items: [
      { id: 'b1',  label: 'B1: Revenue / turnover',             description: 'From audited P&L.' },
      { id: 'b2',  label: 'B1: Less — Cost of sales',           description: 'From audited P&L.' },
      { id: 'b3',  label: 'B1: Gross profit',                   description: 'Revenue minus COGS.' },
      { id: 'b4',  label: 'B1: Less — Operating expenses',      description: 'From audited P&L.' },
      { id: 'b5',  label: 'B1: Add — Other income',             description: 'From audited P&L.' },
      { id: 'b6',  label: 'B1: Less — Finance costs',           description: 'Interest on loans, bank charges.' },
      { id: 'b7',  label: 'B1: Profit/(loss) before tax',       description: 'Per audited financial statements.' },
      { id: 'b8',  label: 'B2–B6: Other income sources',        description: 'Dividend, interest, rental, royalties — each itemised.' },
    ],
  },
  {
    id:    'part-c',
    title: 'PART C — Tax Adjustments',
    items: [
      { id: 'c1', label: 'Entertainment expenses add-back (50%)',      description: 'Non-deductible 50% of entertainment expenses per S39 ITA.' },
      { id: 'c2', label: 'Personal expenses add-back',                 description: 'Any personal expenses charged to company.' },
      { id: 'c3', label: 'Depreciation add-back',                      description: 'Book depreciation not allowed — replaced by capital allowances.' },
      { id: 'c4', label: 'Penalties and fines add-back',               description: 'All fines/penalties are non-deductible.' },
      { id: 'c5', label: 'Non-taxable income deducted',                description: 'Exempt dividends, RPGT proceeds, etc.' },
      { id: 'c6', label: 'Adjusted income confirmed',                  description: 'Profit before tax + add-backs - non-taxable income.' },
    ],
  },
  {
    id:    'part-d',
    title: 'PART D — Capital Allowances',
    items: [
      { id: 'd1', label: 'Fixed asset schedule prepared',                    description: 'All qualifying assets with cost, date, category.' },
      { id: 'd2', label: 'Heavy machinery & motor vehicles (IA 20%, AA 20%)', description: 'Motor vehicles: IA 20% + AA 20% per year.' },
      { id: 'd3', label: 'Office equipment, furniture & fittings (AA 10%)',   description: 'IA 20% year 1; AA 10% annually.' },
      { id: 'd4', label: 'ICT assets (AA 20–40%)',                            description: 'Computers, servers, software.' },
      { id: 'd5', label: 'Plant & machinery (AA 14–20%)',                     description: 'Industrial plant and machinery.' },
      { id: 'd6', label: 'Balancing charges / allowances on disposal',         description: 'Calculate on disposed assets.' },
      { id: 'd7', label: 'Total capital allowances summed',                    description: 'Total CA to deduct from adjusted income.' },
    ],
  },
  {
    id:    'part-e',
    title: 'PART E — Statutory Income & Chargeable Income',
    items: [
      { id: 'e1', label: 'Adjusted income confirmed',                    description: 'From Part C.' },
      { id: 'e2', label: 'Less: Capital allowances applied',             description: 'From Part D total.' },
      { id: 'e3', label: 'Statutory income',                             description: 'Adjusted income minus CA.' },
      { id: 'e4', label: 'Less: Approved donations',                     description: 'Max 10% of aggregate income.' },
      { id: 'e5', label: 'Less: Losses brought forward',                 description: 'Unabsorbed losses from prior years.' },
      { id: 'e6', label: 'Chargeable income confirmed',                  description: 'Final taxable income figure.' },
    ],
  },
  {
    id:    'part-f',
    title: 'PART F — Tax Computation',
    items: [
      { id: 'f1', label: 'SME eligibility confirmed',                   description: 'Paid-up ≤ RM2.5M & turnover ≤ RM50M & not controlled by large co.' },
      { id: 'f2', label: 'First RM150,000 @ 15% (SME) or flat 24%',    description: 'SME rate: first RM150k @ 15%. Non-SME: 24% flat.' },
      { id: 'f3', label: 'RM150,001–RM600,000 @ 17%',                  description: 'SME banded rate.' },
      { id: 'f4', label: 'Above RM600,000 @ 24%',                      description: 'Both SME and non-SME.' },
      { id: 'f5', label: 'Tax payable calculated',                      description: 'Sum of all banded tax.' },
      { id: 'f6', label: 'Less: CP204 instalments paid',               description: 'Receipts for all bi-monthly CP204 payments.' },
      { id: 'f7', label: 'Less: Double deduction claims',              description: 'R&D, training, etc. — supporting evidence required.' },
      { id: 'f8', label: 'Less: Investment tax allowance (if any)',    description: 'ITA / Pioneer Status exemption.' },
      { id: 'f9', label: 'Balance payable / refund confirmed',         description: 'Final tax liability.' },
    ],
  },
  {
    id:    'part-g',
    title: 'PART G — Supplementary Information',
    items: [
      { id: 'g1', label: 'Related party transactions disclosed',        description: 'List all transactions with related entities/persons.' },
      { id: 'g2', label: 'Transfer pricing documentation',              description: 'Required if related party cross-border transactions exist.' },
      { id: 'g3', label: 'e-Invoice compliance status',                 description: 'Confirm phase compliance per LHDN mandate.' },
      { id: 'g4', label: 'SST registration status confirmed',           description: 'If applicable — verify SST number and filings.' },
      { id: 'g5', label: 'CP204 estimate submitted for next year',      description: 'Submit CP204 within 30 days of start of new FY.' },
    ],
  },
  {
    id:    'docs',
    title: 'Supporting Documents Checklist',
    items: [
      { id: 'doc1',  label: 'Audited financial statements',              description: 'P&L, Balance Sheet, Notes to Accounts — signed by auditor.' },
      { id: 'doc2',  label: 'Tax computation schedule',                  description: 'Detailed working for all tax adjustments.' },
      { id: 'doc3',  label: 'Capital allowance schedule',                description: 'Full asset register with IA/AA calculations.' },
      { id: 'doc4',  label: 'CP204 instalment payment receipts',         description: 'All bi-monthly payment receipts for the year.' },
      { id: 'doc5',  label: 'Bank statements',                           description: 'Full year — all company bank accounts.' },
      { id: 'doc6',  label: 'Sales invoices & receipts',                 description: 'Revenue documentation.' },
      { id: 'doc7',  label: 'Expense invoices & receipts',               description: 'All expense documentation.' },
      { id: 'doc8',  label: 'Payroll records & EPF/SOCSO statements',   description: 'Annual payroll summary and contribution statements.' },
      { id: 'doc9',  label: 'Loan agreements & interest statements',     description: 'All loan facilities and annual interest statements.' },
      { id: 'doc10', label: 'Fixed asset register',                      description: 'Current register matching CA schedule.' },
      { id: 'doc11', label: 'Related party transaction schedules',       description: 'If applicable.' },
      { id: 'doc12', label: 'Director\'s fees & remuneration details',   description: 'Form EA issued to directors.' },
      { id: 'doc13', label: 'Previous year Form C',                      description: 'For losses b/f, unabsorbed CA verification.' },
      { id: 'doc14', label: 'Transfer pricing documentation',            description: 'If applicable — contemporaneous documentation.' },
    ],
  },
]

const CHECKLIST_MAP: Record<FlowType, ChecklistSection[]> = {
  INDIVIDUAL_ONLY:     CHECKLIST_INDIVIDUAL_ONLY,
  INDIVIDUAL_BUSINESS: CHECKLIST_INDIVIDUAL_BUSINESS,
  PARTNERSHIP:         CHECKLIST_PARTNERSHIP,
  COMPANY:             CHECKLIST_COMPANY,
}

const FLOW_NOTE: Partial<Record<FlowType, string>> = {
  PARTNERSHIP: 'Partnership does not pay tax at entity level. Each partner reports their share in Form B or Form BE.',
}

const COMPANY_DEADLINE_NOTE =
  'For FYE 31 Dec 2025 → e-Filing deadline: 31 August 2026'

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildDefaultState(sections: ChecklistSection[]): ChecklistState {
  const state: ChecklistState = {}
  for (const s of sections) {
    for (const item of s.items) {
      state[item.id] = { status: 'NOT_STARTED', notes: '' }
    }
  }
  return state
}

function computeProgress(sections: ChecklistSection[], state: ChecklistState) {
  let total = 0, completed = 0, na = 0
  for (const s of sections) {
    for (const item of s.items) {
      total++
      const st = state[item.id]?.status ?? 'NOT_STARTED'
      if (st === 'COMPLETED') completed++
      if (st === 'NA') na++
    }
  }
  const applicable = total - na
  const pct = applicable > 0 ? Math.round((completed / applicable) * 100) : 0
  return { total, completed, na, applicable, pct }
}

// ─── Status indicator ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ItemStatus }) {
  const styles: Record<ItemStatus, React.CSSProperties> = {
    NOT_STARTED: { background: '#DDDDDA', border: '1.5px solid #BBBBBA' },
    IN_PROGRESS: { background: '#888888', border: '1.5px solid #666666' },
    COMPLETED:   { background: '#111111', border: '1.5px solid #111111' },
    NA:          { background: '#FFFFFF', border: '1.5px solid #BBBBBA' },
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        borderRadius: '50%',
        flexShrink: 0,
        ...styles[status],
      }}
      title={STATUS_LABEL[status]}
    />
  )
}

// ─── Checklist item row ───────────────────────────────────────────────────────

function ChecklistRow({
  item,
  state,
  onCycle,
  onNotes,
}: {
  item:    ChecklistItem
  state:   ItemState
  onCycle: () => void
  onNotes: (val: string) => void
}) {
  const [showNotes, setShowNotes] = useState(false)

  return (
    <div
      style={{
        borderBottom: '1px solid #EEEEEC',
        padding: '10px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Cycle button */}
        <button
          onClick={onCycle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 0',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 1,
          }}
          title={`Click to cycle: ${STATUS_LABEL[state.status]}`}
          aria-label={`Status: ${STATUS_LABEL[state.status]}. Click to change.`}
        >
          <StatusDot status={state.status} />
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: state.status === 'NA' ? '#AAAAAA' : state.status === 'COMPLETED' ? '#5E5E5E' : '#111111',
                textDecoration: state.status === 'COMPLETED' ? 'line-through' : 'none',
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 4,
                border: '1px solid #DDDDDA',
                color: '#5E5E5E',
                background: '#F7F7F5',
                whiteSpace: 'nowrap',
              }}
            >
              {STATUS_LABEL[state.status]}
            </span>
          </div>
          {item.description && (
            <p style={{ fontSize: 12, color: '#5E5E5E', marginTop: 2, lineHeight: 1.4 }}>
              {item.description}
            </p>
          )}

          {/* Notes toggle */}
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowNotes(v => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                color: '#888888',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {showNotes ? 'Hide notes' : state.notes ? 'View notes' : '+ Add notes'}
            </button>
            {state.notes && !showNotes && (
              <span style={{ fontSize: 11, color: '#5E5E5E', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {state.notes}
              </span>
            )}
          </div>

          {showNotes && (
            <textarea
              value={state.notes}
              onChange={e => onNotes(e.target.value)}
              placeholder="Add notes here…"
              rows={2}
              style={{
                marginTop: 6,
                width: '100%',
                fontSize: 12,
                color: '#111111',
                background: '#FAFAFA',
                border: '1px solid #DDDDDA',
                borderRadius: 5,
                padding: '6px 8px',
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function ChecklistSectionBlock({
  section,
  state,
  onCycle,
  onNotes,
}: {
  section: ChecklistSection
  state:   ChecklistState
  onCycle: (itemId: string) => void
  onNotes: (itemId: string, val: string) => void
}) {
  const [open, setOpen] = useState(true)

  const items = section.items
  const doneCount = items.filter(i => state[i.id]?.status === 'COMPLETED').length
  const naCount   = items.filter(i => state[i.id]?.status === 'NA').length
  const applicable = items.length - naCount

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #DDDDDA',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {/* Section header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
          borderBottom: open ? '1px solid #DDDDDA' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111111' }}>
            {section.title}
          </span>
          <span style={{ fontSize: 12, color: '#5E5E5E' }}>
            {doneCount}/{applicable} completed
            {naCount > 0 && ` · ${naCount} N/A`}
          </span>
        </div>
        <span style={{ fontSize: 16, color: '#5E5E5E', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
          ›
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 12px' }}>
          {items.map(item => (
            <ChecklistRow
              key={item.id}
              item={item}
              state={state[item.id] ?? { status: 'NOT_STARTED', notes: '' }}
              onCycle={() => onCycle(item.id)}
              onNotes={val => onNotes(item.id, val)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TaxPrepWorkbench({ entity }: Props) {
  const flowType  = entity.flow_type
  const sections  = CHECKLIST_MAP[flowType] ?? []
  const storageKey = `tax-prep-checklist-${entity.id}`

  const [checklistState, setChecklistState] = useState<ChecklistState>(() =>
    buildDefaultState(sections)
  )
  const [loaded, setLoaded] = useState(false)
  const [printMode, setPrintMode] = useState(false)
  const [readyForReview, setReadyForReview] = useState(false)

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as ChecklistState
        setChecklistState(prev => {
          // Merge saved state with fresh defaults (preserves new items)
          const merged = { ...buildDefaultState(sections), ...parsed }
          return merged
        })
      }
    } catch {
      // ignore parse errors
    }
    setLoaded(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Persist to localStorage
  const persist = useCallback((state: ChecklistState) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // ignore storage quota errors
    }
  }, [storageKey])

  function cycleStatus(itemId: string) {
    setChecklistState(prev => {
      const current = prev[itemId]?.status ?? 'NOT_STARTED'
      const idx     = STATUS_CYCLE.indexOf(current)
      const next    = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
      const updated = { ...prev, [itemId]: { ...prev[itemId], status: next } }
      persist(updated)
      return updated
    })
  }

  function updateNotes(itemId: string, notes: string) {
    setChecklistState(prev => {
      const updated = { ...prev, [itemId]: { ...prev[itemId], notes } }
      persist(updated)
      return updated
    })
  }

  function handleReset() {
    if (!confirm('Reset all checklist items for this entity? This cannot be undone.')) return
    const fresh = buildDefaultState(sections)
    setChecklistState(fresh)
    persist(fresh)
    setReadyForReview(false)
  }

  const progress   = computeProgress(sections, checklistState)
  const clientName = entity.client.display_name ?? entity.client.legal_name
  const deadline   = FLOW_DEADLINE[flowType]
  const note       = FLOW_NOTE[flowType]

  if (!loaded) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#5E5E5E', fontSize: 14 }}>
        Loading checklist…
      </div>
    )
  }

  if (printMode) {
    return (
      <PrintView
        entity={entity}
        sections={sections}
        checklistState={checklistState}
        progress={progress}
        onClose={() => setPrintMode(false)}
      />
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── Entity header card ───────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #DDDDDA',
          borderRadius: 8,
          padding: 24,
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <p style={{ fontSize: 12, color: '#5E5E5E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Entity
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111111', marginBottom: 4 }}>
            {entity.entity_name}
          </h2>
          <p style={{ fontSize: 13, color: '#5E5E5E' }}>
            {clientName}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: '#5E5E5E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Flow Type</p>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 5,
                border: '1px solid #DDDDDA',
                fontSize: 12,
                fontWeight: 600,
                color: '#111111',
                background: '#F7F7F5',
              }}
            >
              {flowType.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#5E5E5E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Entity Type</p>
            <p style={{ fontSize: 13, color: '#111111' }}>{entity.entity_type.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#5E5E5E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Financial Year End</p>
            <p style={{ fontSize: 13, color: '#111111', fontVariantNumeric: 'tabular-nums' }}>{entity.financial_year_end ?? '—'}</p>
          </div>
          {entity.tax_reference_no && (
            <div>
              <p style={{ fontSize: 11, color: '#5E5E5E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Tax Ref</p>
              <p style={{ fontSize: 13, color: '#111111', fontVariantNumeric: 'tabular-nums' }}>{entity.tax_reference_no}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Filing profile card ──────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #DDDDDA',
          borderRadius: 8,
          padding: 24,
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 12, color: '#5E5E5E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Filing Profile
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, color: '#5E5E5E', marginBottom: 2 }}>Form to File</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111111' }}>{FLOW_FORM[flowType]}</p>
            <p style={{ fontSize: 12, color: '#5E5E5E', marginTop: 2 }}>{FLOW_TITLE[flowType]}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#5E5E5E', marginBottom: 2 }}>Deadline (Paper)</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111111', fontVariantNumeric: 'tabular-nums' }}>{deadline.paper}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#5E5E5E', marginBottom: 2 }}>e-Filing Deadline</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111111', fontVariantNumeric: 'tabular-nums' }}>{deadline.efiling}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#5E5E5E', marginBottom: 2 }}>Filing Method</p>
            <p style={{ fontSize: 13, color: '#111111' }}>MyTax / e-Filing (ezHASiL)</p>
          </div>
        </div>
        {note && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              background: '#F7F7F5',
              border: '1px solid #DDDDDA',
              borderRadius: 6,
              fontSize: 13,
              color: '#5E5E5E',
            }}
          >
            {note}
          </div>
        )}
        {flowType === 'COMPANY' && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              background: '#F7F7F5',
              border: '1px solid #DDDDDA',
              borderRadius: 6,
              fontSize: 13,
              color: '#5E5E5E',
            }}
          >
            {COMPANY_DEADLINE_NOTE}
          </div>
        )}
      </div>

      {/* ── Progress summary ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #DDDDDA',
          borderRadius: 8,
          padding: 20,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 120 }}>
          <p style={{ fontSize: 11, color: '#5E5E5E', marginBottom: 4 }}>Overall Progress</p>
          <div
            style={{
              height: 8,
              background: '#EEEEEC',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress.pct}%`,
                background: '#111111',
                borderRadius: 4,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <p style={{ fontSize: 12, color: '#5E5E5E', marginTop: 4 }}>
            {progress.completed} of {progress.applicable} applicable items completed ({progress.pct}%)
            {progress.na > 0 && ` · ${progress.na} N/A`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Mark ready for review */}
          <button
            onClick={() => setReadyForReview(v => !v)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #111111',
              background: readyForReview ? '#111111' : '#FFFFFF',
              color: readyForReview ? '#FFFFFF' : '#111111',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {readyForReview ? '✓ Marked Ready for Review' : 'Mark Ready for Review'}
          </button>

          {/* Export summary */}
          <button
            onClick={() => setPrintMode(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #DDDDDA',
              background: '#FFFFFF',
              color: '#111111',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Export Tax Prep Summary
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #DDDDDA',
              background: '#FFFFFF',
              color: '#5E5E5E',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Checklist sections ───────────────────────────────────────────────── */}
      <div>
        {sections.map(section => (
          <ChecklistSectionBlock
            key={section.id}
            section={section}
            state={checklistState}
            onCycle={cycleStatus}
            onNotes={updateNotes}
          />
        ))}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #DDDDDA',
          borderRadius: 8,
          padding: 16,
          marginTop: 12,
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <p style={{ fontSize: 11, color: '#5E5E5E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status Key:</p>
        {STATUS_CYCLE.map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot status={s} />
            <span style={{ fontSize: 12, color: '#5E5E5E' }}>{STATUS_LABEL[s]}</span>
          </div>
        ))}
        <p style={{ fontSize: 11, color: '#AAAAAA', marginLeft: 'auto' }}>
          Click any status indicator to cycle through statuses. State saved locally.
        </p>
      </div>
    </div>
  )
}

// ─── Print / Export view ──────────────────────────────────────────────────────

function PrintView({
  entity,
  sections,
  checklistState,
  progress,
  onClose,
}: {
  entity:         EntityData
  sections:       ChecklistSection[]
  checklistState: ChecklistState
  progress:       ReturnType<typeof computeProgress>
  onClose:        () => void
}) {
  const flowType   = entity.flow_type
  const clientName = entity.client.display_name ?? entity.client.legal_name

  return (
    <div
      style={{
        background: '#FFFFFF',
        minHeight: '100vh',
        padding: 32,
        maxWidth: 800,
        margin: '0 auto',
        fontFamily: "'Avenir Next', system-ui, sans-serif",
        color: '#111111',
      }}
    >
      {/* Close button — hidden in print */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 12 }} className="no-print">
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #DDDDDA',
            background: '#FFFFFF',
            color: '#111111',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ← Back to Checklist
        </button>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            background: '#111111',
            border: 'none',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Header */}
      <div style={{ borderBottom: '2px solid #111111', paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Tax Preparation Summary — {FLOW_FORM[flowType]}
        </h1>
        <p style={{ fontSize: 14, color: '#5E5E5E' }}>
          {entity.entity_name} · {clientName} · YA 2025
        </p>
        <p style={{ fontSize: 13, color: '#5E5E5E', marginTop: 4 }}>
          {FLOW_TITLE[flowType]}
        </p>
        <p style={{ fontSize: 13, color: '#5E5E5E', marginTop: 2 }}>
          Deadline: {FLOW_DEADLINE[flowType].paper} (e-Filing: {FLOW_DEADLINE[flowType].efiling})
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>
          Progress: {progress.completed}/{progress.applicable} items completed ({progress.pct}%)
          {progress.na > 0 && ` · ${progress.na} N/A`}
        </p>
      </div>

      {/* Sections */}
      {sections.map(section => {
        const items = section.items
        return (
          <div key={section.id} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, borderBottom: '1px solid #DDDDDA', paddingBottom: 6, marginBottom: 10 }}>
              {section.title}
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F7F7F5' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #DDDDDA', width: 100 }}>Status</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #DDDDDA' }}>Item</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #DDDDDA' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const st = checklistState[item.id] ?? { status: 'NOT_STARTED' as ItemStatus, notes: '' }
                  return (
                    <tr key={item.id}>
                      <td style={{ padding: '6px 8px', border: '1px solid #DDDDDA', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        {STATUS_LABEL[st.status]}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #DDDDDA', verticalAlign: 'top' }}>
                        <strong>{item.label}</strong>
                        {item.description && (
                          <p style={{ color: '#5E5E5E', marginTop: 2, marginBottom: 0 }}>{item.description}</p>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #DDDDDA', verticalAlign: 'top', color: '#5E5E5E' }}>
                        {st.notes || ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      <p style={{ fontSize: 11, color: '#AAAAAA', borderTop: '1px solid #DDDDDA', paddingTop: 12, marginTop: 24 }}>
        Generated: {new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })} ·
        Accountant Work Replacement System · Malaysia YA 2025
      </p>
    </div>
  )
}
