import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        page:    '#F7F7F5',
        card:    '#FFFFFF',
        panel:   '#F1F1EF',
        border:  '#DDDDDA',
        divider: '#E8E8E5',
        ink: {
          primary:   '#111111',
          secondary: '#5E5E5E',
          muted:     '#8C8C8C',
        },
        accent: {
          DEFAULT: '#111111',
          hover:   '#333333',
        },
        status: {
          success: '#2D6A4F',
          warning: '#92400E',
          error:   '#7F1D1D',
          info:    '#1E3A5F',
        },
      },
      fontFamily: {
        sans: [
          'Avenir Next',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        'page-title': ['28px', { lineHeight: '36px', fontWeight: '700', letterSpacing: '-0.02em' }],
        'section':    ['18px', { lineHeight: '26px', fontWeight: '600', letterSpacing: '-0.01em' }],
        'card-title': ['15px', { lineHeight: '22px', fontWeight: '600', letterSpacing: '-0.005em' }],
        'body':       ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'label':      ['12px', { lineHeight: '18px', fontWeight: '500', letterSpacing: '0.01em' }],
        'table-head': ['12px', { lineHeight: '18px', fontWeight: '600', letterSpacing: '0.02em' }],
      },
      spacing: {
        '1':  '4px',
        '2':  '8px',
        '3':  '12px',
        '4':  '16px',
        '5':  '20px',
        '6':  '24px',
        '8':  '32px',
        '10': '40px',
        '12': '48px',
      },
      borderRadius: {
        card:   '8px',
        button: '6px',
        badge:  '4px',
        input:  '6px',
      },
      boxShadow: {
        card:        '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover':'0 4px 12px 0 rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
export default config
