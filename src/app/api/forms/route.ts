// GET /api/forms — Return available LHDN official forms from manifest
// All forms are downloaded from hasil.gov.my and stored in public/forms/
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

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

function getManifest(): FormsManifest {
  if (!cachedManifest) {
    const manifestPath = join(process.cwd(), 'public', 'forms', 'forms-manifest.json')
    const raw = readFileSync(manifestPath, 'utf-8')
    cachedManifest = JSON.parse(raw) as FormsManifest
  }
  return cachedManifest
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const flow_type      = searchParams.get('flow_type')
    const category       = searchParams.get('category')
    const form_code      = searchParams.get('form_code')
    const year           = searchParams.get('year')
    const language       = searchParams.get('language')

    const manifest = getManifest()
    let forms = manifest.forms

    // Filter by flow_type
    if (flow_type) {
      forms = forms.filter(f => f.flow_types.includes(flow_type))
    }

    // Filter by category
    if (category) {
      forms = forms.filter(f => f.category === category)
    }

    // Filter by form_code (e.g. BE, B, P, C, E, EA, CP204)
    if (form_code) {
      forms = forms.filter(f => f.form_code.toUpperCase() === form_code.toUpperCase())
    }

    // Filter by year_of_assessment
    if (year) {
      const y = parseInt(year)
      forms = forms.filter(f => f.year_of_assessment === y)
    }

    // Filter by language
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
