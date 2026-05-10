import { PrismaClient, FlowType, ReportGroup, TaxDeductibleType, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // ============================================================
  // 1. Default Admin User
  // ============================================================
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@system.local' },
    update: {},
    create: {
      email: 'admin@system.local',
      name: 'System Admin',
      role: UserRole.OWNER,
      is_active: true,
    },
  })
  console.log('Admin user created:', adminUser.id)

  // ============================================================
  // 2. Accounting Categories (Malaysia Standard Chart of Accounts)
  // ============================================================
  const accountingCategories = [
    // --- REVENUE ---
    { code: 'REV-001', name: 'Sales Revenue', name_zh: '销售收入', report_group: ReportGroup.REVENUE, sort_order: 10, is_system: true },
    { code: 'REV-002', name: 'Service Revenue', name_zh: '服务收入', report_group: ReportGroup.REVENUE, sort_order: 20, is_system: true },
    { code: 'REV-003', name: 'Commission Income', name_zh: '佣金收入', report_group: ReportGroup.REVENUE, sort_order: 30, is_system: true },
    { code: 'REV-004', name: 'Rental Income (Business)', name_zh: '业务租金收入', report_group: ReportGroup.REVENUE, sort_order: 40, is_system: true },
    { code: 'REV-005', name: 'Project Income', name_zh: '项目收入', report_group: ReportGroup.REVENUE, sort_order: 50, is_system: true },
    { code: 'REV-006', name: 'Freelance Income', name_zh: '自由职业收入', report_group: ReportGroup.REVENUE, sort_order: 60, is_system: true },
    { code: 'REV-007', name: 'Employment Income', name_zh: '受雇收入', report_group: ReportGroup.REVENUE, sort_order: 70, is_system: true },

    // --- COST OF SALES ---
    { code: 'COS-001', name: 'Cost of Goods Sold', name_zh: '销售成本', report_group: ReportGroup.COST_OF_SALES, sort_order: 110, is_system: true },
    { code: 'COS-002', name: 'Direct Labour', name_zh: '直接人工', report_group: ReportGroup.COST_OF_SALES, sort_order: 120, is_system: true },
    { code: 'COS-003', name: 'Direct Material', name_zh: '直接材料', report_group: ReportGroup.COST_OF_SALES, sort_order: 130, is_system: true },
    { code: 'COS-004', name: 'Subcontractor Cost', name_zh: '分包商费用', report_group: ReportGroup.COST_OF_SALES, sort_order: 140, is_system: true },
    { code: 'COS-005', name: 'Direct Project Expenses', name_zh: '直接项目支出', report_group: ReportGroup.COST_OF_SALES, sort_order: 150, is_system: true },

    // --- OPERATING EXPENSE ---
    { code: 'OPX-001', name: 'Salary & EPF & SOCSO', name_zh: '薪酬与公积金与社险', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 210, is_system: true },
    { code: 'OPX-002', name: 'Director Remuneration', name_zh: '董事薪酬', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 220, is_system: true },
    { code: 'OPX-003', name: 'Office Rental', name_zh: '办公室租金', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 230, is_system: true },
    { code: 'OPX-004', name: 'Utilities', name_zh: '水电费', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 240, is_system: true },
    { code: 'OPX-005', name: 'Telephone & Internet', name_zh: '电话与网络费', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 250, is_system: true },
    { code: 'OPX-006', name: 'Printing & Stationery', name_zh: '印刷与文具', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 260, is_system: true },
    { code: 'OPX-007', name: 'Motor Vehicle Expenses', name_zh: '汽车费用', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 270, is_system: true },
    { code: 'OPX-008', name: 'Travelling & Accommodation', name_zh: '差旅与住宿', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 280, is_system: true },
    { code: 'OPX-009', name: 'Entertainment & Meals', name_zh: '娱乐与餐饮', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 290, is_system: true },
    { code: 'OPX-010', name: 'Advertising & Marketing', name_zh: '广告与市场推广', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 300, is_system: true },
    { code: 'OPX-011', name: 'Professional Fees', name_zh: '专业费用', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 310, is_system: true },
    { code: 'OPX-012', name: 'Audit Fee', name_zh: '审计费', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 320, is_system: true },
    { code: 'OPX-013', name: 'Tax Agent Fee', name_zh: '税务代理费', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 330, is_system: true },
    { code: 'OPX-014', name: 'Secretary Fee', name_zh: '秘书费', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 340, is_system: true },
    { code: 'OPX-015', name: 'Insurance', name_zh: '保险费', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 350, is_system: true },
    { code: 'OPX-016', name: 'Repair & Maintenance', name_zh: '维修与保养', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 360, is_system: true },
    { code: 'OPX-017', name: 'Depreciation', name_zh: '折旧', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 370, is_system: true },
    { code: 'OPX-018', name: 'Bank Charges', name_zh: '银行手续费', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 380, is_system: true },
    { code: 'OPX-019', name: 'Postage & Courier', name_zh: '邮寄与快递', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 390, is_system: true },
    { code: 'OPX-020', name: 'Staff Training & Development', name_zh: '员工培训', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 400, is_system: true },
    { code: 'OPX-021', name: 'Staff Welfare', name_zh: '员工福利', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 410, is_system: true },
    { code: 'OPX-022', name: 'Subscription & License', name_zh: '订阅与授权', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 420, is_system: true },
    { code: 'OPX-023', name: 'SST (Service Tax Expense)', name_zh: '服务税支出', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 430, is_system: true },
    { code: 'OPX-024', name: 'Bad Debts Written Off', name_zh: '坏账注销', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 440, is_system: true },
    { code: 'OPX-025', name: 'Donation & Contribution', name_zh: '捐款', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 450, is_system: true },
    { code: 'OPX-026', name: 'Miscellaneous Expenses', name_zh: '杂项支出', report_group: ReportGroup.OPERATING_EXPENSE, sort_order: 460, is_system: true },

    // --- OTHER INCOME ---
    { code: 'OTH-001', name: 'Interest Income', name_zh: '利息收入', report_group: ReportGroup.OTHER_INCOME, sort_order: 510, is_system: true },
    { code: 'OTH-002', name: 'Dividend Income', name_zh: '股息收入', report_group: ReportGroup.OTHER_INCOME, sort_order: 520, is_system: true },
    { code: 'OTH-003', name: 'Rental Income (Non-Business)', name_zh: '非业务租金收入', report_group: ReportGroup.OTHER_INCOME, sort_order: 530, is_system: true },
    { code: 'OTH-004', name: 'Gain on Disposal of Assets', name_zh: '资产处置收益', report_group: ReportGroup.OTHER_INCOME, sort_order: 540, is_system: true },
    { code: 'OTH-005', name: 'Foreign Exchange Gain', name_zh: '汇兑收益', report_group: ReportGroup.OTHER_INCOME, sort_order: 550, is_system: true },
    { code: 'OTH-006', name: 'Grant & Subsidy', name_zh: '补贴与拨款', report_group: ReportGroup.OTHER_INCOME, sort_order: 560, is_system: true },
    { code: 'OTH-007', name: 'Other Miscellaneous Income', name_zh: '其他杂项收入', report_group: ReportGroup.OTHER_INCOME, sort_order: 570, is_system: true },

    // --- FINANCE COST ---
    { code: 'FIN-001', name: 'Interest Expense (Loan)', name_zh: '贷款利息支出', report_group: ReportGroup.FINANCE_COST, sort_order: 610, is_system: true },
    { code: 'FIN-002', name: 'Interest Expense (Overdraft)', name_zh: '透支利息支出', report_group: ReportGroup.FINANCE_COST, sort_order: 620, is_system: true },
    { code: 'FIN-003', name: 'Hire Purchase Interest', name_zh: '分期付款利息', report_group: ReportGroup.FINANCE_COST, sort_order: 630, is_system: true },
    { code: 'FIN-004', name: 'Foreign Exchange Loss', name_zh: '汇兑损失', report_group: ReportGroup.FINANCE_COST, sort_order: 640, is_system: true },

    // --- TAX EXPENSE ---
    { code: 'TAX-001', name: 'Income Tax Expense', name_zh: '所得税支出', report_group: ReportGroup.TAX_EXPENSE, sort_order: 710, is_system: true },
    { code: 'TAX-002', name: 'Deferred Tax', name_zh: '递延税务', report_group: ReportGroup.TAX_EXPENSE, sort_order: 720, is_system: true },

    // --- BALANCE SHEET: ASSETS ---
    { code: 'BSA-001', name: 'Cash at Bank', name_zh: '银行现金', report_group: ReportGroup.BALANCE_SHEET_ASSET, sort_order: 810, is_system: true },
    { code: 'BSA-002', name: 'Cash in Hand', name_zh: '手头现金', report_group: ReportGroup.BALANCE_SHEET_ASSET, sort_order: 820, is_system: true },
    { code: 'BSA-003', name: 'Trade Receivables', name_zh: '贸易应收账款', report_group: ReportGroup.BALANCE_SHEET_ASSET, sort_order: 830, is_system: true },
    { code: 'BSA-004', name: 'Other Receivables & Deposits', name_zh: '其他应收款与订金', report_group: ReportGroup.BALANCE_SHEET_ASSET, sort_order: 840, is_system: true },
    { code: 'BSA-005', name: 'Inventory / Stock', name_zh: '库存', report_group: ReportGroup.BALANCE_SHEET_ASSET, sort_order: 850, is_system: true },
    { code: 'BSA-006', name: 'Prepayments', name_zh: '预付款', report_group: ReportGroup.BALANCE_SHEET_ASSET, sort_order: 860, is_system: true },
    { code: 'BSA-007', name: 'Property, Plant & Equipment', name_zh: '固定资产', report_group: ReportGroup.BALANCE_SHEET_ASSET, sort_order: 870, is_system: true },
    { code: 'BSA-008', name: 'Investment', name_zh: '投资', report_group: ReportGroup.BALANCE_SHEET_ASSET, sort_order: 880, is_system: true },

    // --- BALANCE SHEET: LIABILITIES ---
    { code: 'BSL-001', name: 'Trade Payables', name_zh: '贸易应付账款', report_group: ReportGroup.BALANCE_SHEET_LIABILITY, sort_order: 910, is_system: true },
    { code: 'BSL-002', name: 'Other Payables & Accruals', name_zh: '其他应付款与应计款', report_group: ReportGroup.BALANCE_SHEET_LIABILITY, sort_order: 920, is_system: true },
    { code: 'BSL-003', name: 'Bank Borrowings / Loan', name_zh: '银行借款', report_group: ReportGroup.BALANCE_SHEET_LIABILITY, sort_order: 930, is_system: true },
    { code: 'BSL-004', name: 'Hire Purchase Payable', name_zh: '分期付款应付款', report_group: ReportGroup.BALANCE_SHEET_LIABILITY, sort_order: 940, is_system: true },
    { code: 'BSL-005', name: 'Tax Payable', name_zh: '税务应付款', report_group: ReportGroup.BALANCE_SHEET_LIABILITY, sort_order: 950, is_system: true },
    { code: 'BSL-006', name: 'Director Loan (Liability)', name_zh: '董事贷款（负债）', report_group: ReportGroup.BALANCE_SHEET_LIABILITY, sort_order: 960, is_system: true },

    // --- BALANCE SHEET: EQUITY ---
    { code: 'BSE-001', name: 'Share Capital', name_zh: '股本', report_group: ReportGroup.BALANCE_SHEET_EQUITY, sort_order: 1010, is_system: true },
    { code: 'BSE-002', name: 'Retained Earnings', name_zh: '留存收益', report_group: ReportGroup.BALANCE_SHEET_EQUITY, sort_order: 1020, is_system: true },
    { code: 'BSE-003', name: 'Current Year Profit/(Loss)', name_zh: '本年盈亏', report_group: ReportGroup.BALANCE_SHEET_EQUITY, sort_order: 1030, is_system: true },
    { code: 'BSE-004', name: 'Partners Capital Account', name_zh: '合伙人资本账户', report_group: ReportGroup.BALANCE_SHEET_EQUITY, sort_order: 1040, is_system: true },
    { code: 'BSE-005', name: 'Owner\'s Capital', name_zh: '业主资本', report_group: ReportGroup.BALANCE_SHEET_EQUITY, sort_order: 1050, is_system: true },
    { code: 'BSE-006', name: 'Drawings', name_zh: '提款', report_group: ReportGroup.BALANCE_SHEET_EQUITY, sort_order: 1060, is_system: true },
  ]

  for (const cat of accountingCategories) {
    await prisma.accountingCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    })
  }
  console.log(`Created ${accountingCategories.length} accounting categories`)

  // ============================================================
  // 3. Tax Categories (LHDN Malaysia Standard)
  // ============================================================
  const taxCategories = [
    // --- FULLY DEDUCTIBLE ---
    { code: 'TX-FD-001', name: 'Salary, Wages & EPF Contribution', name_zh: '薪酬与公积金（可全额扣除）', deductible_type: TaxDeductibleType.FULLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Fully deductible under s.33 ITA 1967', is_system: true },
    { code: 'TX-FD-002', name: 'Office Rental', name_zh: '办公室租金（可全额扣除）', deductible_type: TaxDeductibleType.FULLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Fully deductible business expense', is_system: true },
    { code: 'TX-FD-003', name: 'Utilities (Business)', name_zh: '业务水电费（可全额扣除）', deductible_type: TaxDeductibleType.FULLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], is_system: true },
    { code: 'TX-FD-004', name: 'Professional Fees (Audit, Tax, Legal)', name_zh: '专业费用（可全额扣除）', deductible_type: TaxDeductibleType.FULLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], is_system: true },
    { code: 'TX-FD-005', name: 'Insurance (Business)', name_zh: '业务保险（可全额扣除）', deductible_type: TaxDeductibleType.FULLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], is_system: true },
    { code: 'TX-FD-006', name: 'Repair & Maintenance (Revenue Nature)', name_zh: '维修保养-收益性质（可全额扣除）', deductible_type: TaxDeductibleType.FULLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Must be revenue in nature, not capital', is_system: true },
    { code: 'TX-FD-007', name: 'Bank Charges', name_zh: '银行手续费（可全额扣除）', deductible_type: TaxDeductibleType.FULLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], is_system: true },
    { code: 'TX-FD-008', name: 'Telephone & Internet (Business)', name_zh: '业务电话与网络费（可全额扣除）', deductible_type: TaxDeductibleType.FULLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], is_system: true },

    // --- PARTIALLY DEDUCTIBLE ---
    { code: 'TX-PD-001', name: 'Entertainment Expenses (50% Rule)', name_zh: '娱乐费（限制扣除50%）', deductible_type: TaxDeductibleType.PARTIALLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Entertainment expenses are restricted to 50% under s.39(1)(l) ITA 1967', default_adjustment_rule: 'ADD_BACK_50_PERCENT', is_system: true },
    { code: 'TX-PD-002', name: 'Motor Vehicle Expenses (Private Use Portion)', name_zh: '汽车费用（私用部分限制扣除）', deductible_type: TaxDeductibleType.PARTIALLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Private use portion is not deductible', is_system: true },
    { code: 'TX-PD-003', name: 'Travelling (Mixed Business & Private)', name_zh: '差旅费（混合商务与私人用途）', deductible_type: TaxDeductibleType.PARTIALLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], is_system: true },
    { code: 'TX-PD-004', name: 'Donation (Approved Institution)', name_zh: '捐款（核准机构）', deductible_type: TaxDeductibleType.PARTIALLY_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Restricted to 10% of aggregate income for companies', is_system: true },

    // --- NON DEDUCTIBLE ---
    { code: 'TX-ND-001', name: 'Personal Expenses', name_zh: '个人支出（不可扣除）', deductible_type: TaxDeductibleType.NON_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Not incurred wholly and exclusively for business', is_system: true },
    { code: 'TX-ND-002', name: 'Capital Expenditure (Without CA)', name_zh: '资本支出（无资本免税额）', deductible_type: TaxDeductibleType.NON_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Capital in nature, deduct via Capital Allowance instead', is_system: true },
    { code: 'TX-ND-003', name: 'Fine & Penalty', name_zh: '罚款与罚金（不可扣除）', deductible_type: TaxDeductibleType.NON_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Specifically disallowed under s.39 ITA 1967', is_system: true },
    { code: 'TX-ND-004', name: 'Director Fee to Related Party (Excessive)', name_zh: '关联方董事费（过高部分不可扣除）', deductible_type: TaxDeductibleType.NON_DEDUCTIBLE, applicable_forms: ['Form C'], is_system: true },
    { code: 'TX-ND-005', name: 'Income Tax Expense', name_zh: '所得税支出（不可扣除）', deductible_type: TaxDeductibleType.NON_DEDUCTIBLE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Income tax is not a deductible expense', is_system: true },

    // --- CAPITAL ALLOWANCE ---
    { code: 'TX-CA-001', name: 'Plant & Machinery (Capital Allowance)', name_zh: '机器设备（资本免税额）', deductible_type: TaxDeductibleType.CAPITAL_ALLOWANCE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'IA 20%, AA 14% per annum (Schedule 3 ITA 1967)', is_system: true },
    { code: 'TX-CA-002', name: 'Motor Vehicle (Capital Allowance)', name_zh: '汽车（资本免税额）', deductible_type: TaxDeductibleType.CAPITAL_ALLOWANCE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'IA 20%, AA 20% per annum. Cost restricted to RM50K or RM150K for certain vehicles', is_system: true },
    { code: 'TX-CA-003', name: 'Office Equipment & Furniture (Capital Allowance)', name_zh: '办公设备与家具（资本免税额）', deductible_type: TaxDeductibleType.CAPITAL_ALLOWANCE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'IA 20%, AA 10% per annum', is_system: true },
    { code: 'TX-CA-004', name: 'Computer & IT Equipment (Capital Allowance)', name_zh: '电脑与IT设备（资本免税额）', deductible_type: TaxDeductibleType.CAPITAL_ALLOWANCE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'IA 20%, AA 20% per annum', is_system: true },
    { code: 'TX-CA-005', name: 'Building Renovation (Capital Allowance)', name_zh: '厂房翻新（资本免税额）', deductible_type: TaxDeductibleType.CAPITAL_ALLOWANCE, applicable_forms: ['Form B', 'Form C', 'Form P'], lhdn_note: 'Industrial building allowance or renovation allowance applicable', is_system: true },

    // --- PERSONAL RELIEF (INDIVIDUAL) ---
    { code: 'TX-PR-001', name: 'EPF Contribution (Personal)', name_zh: 'EPF个人供款（个人免税额）', deductible_type: TaxDeductibleType.PERSONAL_RELIEF, applicable_forms: ['Form BE', 'Form B'], lhdn_note: 'Max RM4,000 per YA (2026)', is_system: true },
    { code: 'TX-PR-002', name: 'Life Insurance & Takaful', name_zh: '人寿保险与伊斯兰保险（个人免税额）', deductible_type: TaxDeductibleType.PERSONAL_RELIEF, applicable_forms: ['Form BE', 'Form B'], lhdn_note: 'Max RM3,000 per YA (2026)', is_system: true },
    { code: 'TX-PR-003', name: 'Medical Expenses (Serious Disease)', name_zh: '重病医疗费用（个人免税额）', deductible_type: TaxDeductibleType.PERSONAL_RELIEF, applicable_forms: ['Form BE', 'Form B'], lhdn_note: 'Max RM10,000 per YA (2026)', is_system: true },
    { code: 'TX-PR-004', name: 'Education Fees (Self)', name_zh: '自身教育费（个人免税额）', deductible_type: TaxDeductibleType.PERSONAL_RELIEF, applicable_forms: ['Form BE', 'Form B'], lhdn_note: 'Max RM7,000 per YA (2026)', is_system: true },
    { code: 'TX-PR-005', name: 'SSPN Net Savings', name_zh: 'SSPN净储蓄（个人免税额）', deductible_type: TaxDeductibleType.PERSONAL_RELIEF, applicable_forms: ['Form BE', 'Form B'], lhdn_note: 'Max RM8,000 per YA (2026)', is_system: true },
    { code: 'TX-PR-006', name: 'Lifestyle Relief (Books, Internet, Sports)', name_zh: '生活方式免税额', deductible_type: TaxDeductibleType.PERSONAL_RELIEF, applicable_forms: ['Form BE', 'Form B'], lhdn_note: 'Max RM2,500 per YA (2026)', is_system: true },
    { code: 'TX-PR-007', name: 'Childcare & Nursery Fees', name_zh: '托儿费用（个人免税额）', deductible_type: TaxDeductibleType.PERSONAL_RELIEF, applicable_forms: ['Form BE', 'Form B'], lhdn_note: 'Max RM3,000 per YA (2026)', is_system: true },
  ]

  for (const tc of taxCategories) {
    await prisma.taxCategory.upsert({
      where: { code: tc.code },
      update: {},
      create: tc,
    })
  }
  console.log(`Created ${taxCategories.length} tax categories`)

  // ============================================================
  // 4. Checklist Templates (4 flow types × 2 phases)
  // ============================================================

  const checklistTemplates = [
    // --- INDIVIDUAL_ONLY: MONTHLY (N/A — 使用 TAX_PREP) ---
    {
      flow_type: FlowType.INDIVIDUAL_ONLY,
      phase: 'TAX_PREP',
      version: '1.0',
      items_json: [
        { key: 'ic_copy', label: 'MyKad copy collected', required: true, status: 'PENDING' },
        { key: 'ea_form', label: 'EA Form (from employer) collected', required: true, status: 'PENDING' },
        { key: 'epf_statement', label: 'EPF annual statement collected', required: true, status: 'PENDING' },
        { key: 'employment_income_verified', label: 'Employment income verified against EA Form', required: true, status: 'PENDING' },
        { key: 'other_income_docs', label: 'Other income documents collected (rental, dividend, etc.)', required: false, status: 'PENDING' },
        { key: 'life_insurance', label: 'Life insurance / Takaful premium statement collected', required: false, status: 'PENDING' },
        { key: 'medical_receipts', label: 'Medical / serious disease receipts collected', required: false, status: 'PENDING' },
        { key: 'education_receipts', label: 'Education fee receipts collected', required: false, status: 'PENDING' },
        { key: 'sspn_statement', label: 'SSPN savings statement collected', required: false, status: 'PENDING' },
        { key: 'lifestyle_receipts', label: 'Lifestyle relief receipts collected (books, internet, sports)', required: false, status: 'PENDING' },
        { key: 'childcare_receipts', label: 'Childcare / nursery fee receipts collected', required: false, status: 'PENDING' },
        { key: 'relief_summary_done', label: 'Relief items summary completed and verified', required: true, status: 'PENDING' },
        { key: 'form_be_ready', label: 'Form BE data ready for licensed tax agent review', required: true, status: 'PENDING' },
      ],
    },

    // --- INDIVIDUAL_BUSINESS: TAX_PREP ---
    {
      flow_type: FlowType.INDIVIDUAL_BUSINESS,
      phase: 'TAX_PREP',
      version: '1.0',
      items_json: [
        { key: 'business_registration', label: 'Business registration document collected (SSM)', required: true, status: 'PENDING' },
        { key: 'all_bank_imports_done', label: 'All business bank statements imported and parsed', required: true, status: 'PENDING' },
        { key: 'all_txns_classified', label: 'All transactions classified', required: true, status: 'PENDING' },
        { key: 'revenue_verified', label: 'Business revenue verified against invoices issued', required: true, status: 'PENDING' },
        { key: 'expenses_verified', label: 'Business expenses verified with receipts', required: true, status: 'PENDING' },
        { key: 'non_deductible_identified', label: 'Non-deductible items identified (entertainment, personal use)', required: true, status: 'PENDING' },
        { key: 'ca_schedule_done', label: 'Capital Allowance (CA) schedule prepared', required: true, status: 'PENDING' },
        { key: 'pnl_draft_generated', label: 'Management P&L draft generated', required: true, status: 'PENDING' },
        { key: 'personal_relief_items_done', label: 'Personal relief items collected and summarized', required: true, status: 'PENDING' },
        { key: 'form_b_ready', label: 'Form B data ready for licensed tax agent review', required: true, status: 'PENDING' },
      ],
    },

    // --- INDIVIDUAL_BUSINESS: MONTHLY_CLOSE ---
    {
      flow_type: FlowType.INDIVIDUAL_BUSINESS,
      phase: 'MONTHLY_CLOSE',
      version: '1.0',
      items_json: [
        { key: 'bank_statement_imported', label: 'Bank statement for the month imported', required: true, status: 'PENDING' },
        { key: 'all_txns_classified', label: 'All transactions classified', required: true, status: 'PENDING' },
        { key: 'missing_docs_resolved', label: 'Missing documents resolved or noted', required: true, status: 'PENDING' },
        { key: 'high_risk_reviewed', label: 'High-risk and flagged items reviewed', required: true, status: 'PENDING' },
        { key: 'income_summarized', label: 'Monthly income summarized', required: true, status: 'PENDING' },
        { key: 'expense_summarized', label: 'Monthly expense summarized', required: true, status: 'PENDING' },
        { key: 'unresolved_issues_noted', label: 'Unresolved issues documented', required: false, status: 'PENDING' },
      ],
    },

    // --- PARTNERSHIP: MONTHLY_CLOSE ---
    {
      flow_type: FlowType.PARTNERSHIP,
      phase: 'MONTHLY_CLOSE',
      version: '1.0',
      items_json: [
        { key: 'bank_statement_imported', label: 'Partnership bank statement imported', required: true, status: 'PENDING' },
        { key: 'all_txns_classified', label: 'All transactions classified', required: true, status: 'PENDING' },
        { key: 'missing_docs_resolved', label: 'Missing documents resolved or noted', required: true, status: 'PENDING' },
        { key: 'high_risk_reviewed', label: 'High-risk items reviewed', required: true, status: 'PENDING' },
        { key: 'drawings_recorded', label: 'Partner drawings and capital movements recorded', required: true, status: 'PENDING' },
        { key: 'partner_ledger_updated', label: 'Partner ledger entries updated', required: true, status: 'PENDING' },
        { key: 'pnl_draft_available', label: 'P&L draft available for review', required: true, status: 'PENDING' },
      ],
    },

    // --- PARTNERSHIP: TAX_PREP ---
    {
      flow_type: FlowType.PARTNERSHIP,
      phase: 'TAX_PREP',
      version: '1.0',
      items_json: [
        { key: 'partnership_registration', label: 'Partnership registration document collected', required: true, status: 'PENDING' },
        { key: 'profit_sharing_agreement', label: 'Profit sharing agreement reviewed and confirmed', required: true, status: 'PENDING' },
        { key: 'full_year_pnl_done', label: 'Full year P&L completed and verified', required: true, status: 'PENDING' },
        { key: 'all_txns_classified', label: 'All transactions classified', required: true, status: 'PENDING' },
        { key: 'ca_schedule_done', label: 'Capital Allowance schedule prepared', required: true, status: 'PENDING' },
        { key: 'apportionment_calculated', label: 'Profit/loss apportionment calculated per partner', required: true, status: 'PENDING' },
        { key: 'partner_details_confirmed', label: 'All partner details (IC, tax no) confirmed', required: true, status: 'PENDING' },
        { key: 'form_p_ready', label: 'Form P data ready for licensed tax agent', required: true, status: 'PENDING' },
        { key: 'partner_form_b_data', label: 'Each partner Form B data prepared', required: true, status: 'PENDING' },
      ],
    },

    // --- COMPANY: MONTHLY_CLOSE ---
    {
      flow_type: FlowType.COMPANY,
      phase: 'MONTHLY_CLOSE',
      version: '1.0',
      items_json: [
        { key: 'all_bank_statements_imported', label: 'All bank statements for the month imported', required: true, status: 'PENDING' },
        { key: 'all_txns_classified', label: 'All transactions classified', required: true, status: 'PENDING' },
        { key: 'all_docs_bound', label: 'Supporting documents bound to transactions', required: true, status: 'PENDING' },
        { key: 'missing_docs_resolved', label: 'Missing documents resolved or issued as unresolved', required: true, status: 'PENDING' },
        { key: 'high_risk_reviewed', label: 'High-risk and flagged transactions reviewed', required: true, status: 'PENDING' },
        { key: 'director_txns_reviewed', label: 'Director-related transactions reviewed and noted', required: true, status: 'PENDING' },
        { key: 'related_party_noted', label: 'Related party transactions identified and noted', required: true, status: 'PENDING' },
        { key: 'bank_reconciliation_done', label: 'Bank reconciliation completed', required: true, status: 'PENDING' },
        { key: 'pnl_draft_generated', label: 'Monthly P&L draft generated', required: true, status: 'PENDING' },
        { key: 'unresolved_issues_logged', label: 'Unresolved issues logged in system', required: true, status: 'PENDING' },
      ],
    },

    // --- COMPANY: TAX_PREP ---
    {
      flow_type: FlowType.COMPANY,
      phase: 'TAX_PREP',
      version: '1.0',
      items_json: [
        { key: 'full_year_pnl_done', label: 'Full year management P&L completed', required: true, status: 'PENDING' },
        { key: 'all_txns_classified', label: 'All transactions classified for the full year', required: true, status: 'PENDING' },
        { key: 'non_deductible_identified', label: 'All non-deductible items identified and add-back prepared', required: true, status: 'PENDING' },
        { key: 'entertainment_50pct', label: 'Entertainment expenses 50% add-back prepared', required: true, status: 'PENDING' },
        { key: 'ca_schedule_done', label: 'Capital Allowance (CA) schedule prepared (Schedule 3)', required: true, status: 'PENDING' },
        { key: 'director_fee_reviewed', label: 'Director fees and related party payments reviewed', required: true, status: 'PENDING' },
        { key: 'cp204_installments_reviewed', label: 'CP204 installment history reviewed', required: true, status: 'PENDING' },
        { key: 'sme_status_confirmed', label: 'SME tax rate eligibility confirmed (capital ≤ RM2.5M)', required: true, status: 'PENDING' },
        { key: 'tax_computation_draft', label: 'Tax computation draft prepared', required: true, status: 'PENDING' },
        { key: 'form_c_ready', label: 'Form C data ready for licensed tax agent review', required: true, status: 'PENDING' },
      ],
    },

    // --- COMPANY: AUDITOR_PACK ---
    {
      flow_type: FlowType.COMPANY,
      phase: 'AUDITOR_PACK',
      version: '1.0',
      items_json: [
        { key: 'full_year_pnl', label: 'Full year P&L included', required: true, status: 'PENDING' },
        { key: 'ytd_pnl', label: 'YTD P&L included', required: true, status: 'PENDING' },
        { key: 'gl_listing', label: 'General Ledger listing included', required: true, status: 'PENDING' },
        { key: 'bank_statements_all', label: 'All bank statements included', required: true, status: 'PENDING' },
        { key: 'supporting_docs_register', label: 'Supporting documents register included', required: true, status: 'PENDING' },
        { key: 'unresolved_issues_list', label: 'Unresolved issues list included', required: true, status: 'PENDING' },
        { key: 'ca_schedule', label: 'Capital Allowance schedule included', required: true, status: 'PENDING' },
        { key: 'director_txns_schedule', label: 'Director-related transactions schedule included', required: true, status: 'PENDING' },
        { key: 'related_party_schedule', label: 'Related party transactions schedule included', required: true, status: 'PENDING' },
        { key: 'notes_to_accounts_draft', label: 'Draft notes to accounts included', required: false, status: 'PENDING' },
      ],
    },
  ]

  for (const template of checklistTemplates) {
    await prisma.checklistTemplate.create({ data: template })
  }
  console.log(`Created ${checklistTemplates.length} checklist templates`)

  console.log('Seed completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
