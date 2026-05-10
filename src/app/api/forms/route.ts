// GET /api/forms — Return available LHDN official forms
// In production (Railway), manifest is fetched from GitHub raw URL.
// In development, manifest is read from local public/forms/forms-manifest.json
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// GitHub raw URL base — PDFs are stored in the repo even if excluded from Railway build
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/zee14913913/accountant-tax_lab/main'

const MANIFEST_URL = `${GITHUB_RAW_BASE}/public/forms/forms-manifest.json`

interface TaxForm {
  id: string
  form_code: string
  form_name: string
  form_name_bm?: string
  year_of_assessment: number | null
  flow_types: string[]
  due_date?: string
  e_filing_due?: string
  category: 'individual' | 'company' | 'employer' | 'installment' | 'other'
  language: string
  file: string
  source_url: string
  description: string
}

interface FormsManifest {
  last_updated: string
  source: string
  note: string
  forms: TaxForm[]
  important_notes: Record<string, string>
}

let cachedManifest: FormsManifest | null = null

async function getManifest(): Promise<FormsManifest> {
  if (cachedManifest) return cachedManifest

  if (process.env.NODE_ENV === 'production') {
    // Fetch from GitHub raw (avoids needing PDFs in Railway container)
    const res = await fetch(MANIFEST_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`Failed to fetch manifest from GitHub: ${res.status}`)
    cachedManifest = await res.json() as FormsManifest
  } else {
    // Local development: read from filesystem
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const manifestPath = join(process.cwd(), 'public', 'forms', 'forms-manifest.json')
    const raw = readFileSync(manifestPath, 'utf-8')
    cachedManifest = JSON.parse(raw) as FormsManifest
  }

  // Rewrite file paths to full GitHub raw URLs in production
  if (process.env.NODE_ENV === 'production' && cachedManifest) {
    cachedManifest.forms = cachedManifest.forms.map(f => ({
      ...f,
      download_url: f.file
        ? `${GITHUB_RAW_BASE}/public/forms/${f.file}`
        : null,
    })) as TaxForm[]
  }

  return cachedManifest
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const flow_type = searchParams.get('flow_type')
    const category  = searchParams.get('category')
    const form_code = searchParams.get('form_code')
    const year      = searchParams.get('year')
    const language  = searchParams.get('language')

    const manifest = await getManifest()
    let forms = manifest.forms

    if (flow_type) {
      forms = forms.filter(f => f.flow_types.includes(flow_type))
    }
    if (category) {
      forms = forms.filter(f => f.category === category)
    }
    if (form_code) {
      forms = forms.filter(f => f.form_code.toUpperCase() === form_code.toUpperCase())
    }
    if (year) {
      const y = parseInt(year)
      forms = forms.filter(f => f.year_of_assessment === y)
    }
    if (language) {
      forms = forms.filter(f => f.language.toUpperCase().includes(language.toUpperCase()))
    }

    return NextResponse.json({
      data: forms,
      meta: {
        total: forms.length,
        last_updated: manifest.last_updated,
        source: manifest.source,
        note: manifest.note,
      },
      important_notes: manifest.important_notes,
    })
  } catch (err) {
    console.error('[/api/forms GET]', err)
    return NextResponse.json({ error: 'Failed to load forms manifest' }, { status: 500 })
  }
}
