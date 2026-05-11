import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number | string,
  currency: string = 'MYR',
  locale: string = 'en-MY'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: Date | string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const formatMap: Record<string, Intl.DateTimeFormatOptions> = {
    short:  { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long:   { day: 'numeric', month: 'long', year: 'numeric' },
  }
  const options = formatMap[format]
  return d.toLocaleDateString('en-MY', options)
}

export function generateClientCode(prefix: string = 'CLT'): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `${prefix}-${year}-${random}`
}

export const FLOW_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_ONLY:     'Individual',
  INDIVIDUAL_BUSINESS: 'Individual + Business',
  PARTNERSHIP:         'Partnership',
  COMPANY:             'Company / Sdn Bhd',
}

export const FLOW_TYPE_FORM: Record<string, string> = {
  INDIVIDUAL_ONLY:     'Form BE',
  INDIVIDUAL_BUSINESS: 'Form B',
  PARTNERSHIP:         'Form P',
  COMPANY:             'Form C + CP204',
}
