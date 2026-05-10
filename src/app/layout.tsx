import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Accountant Work Replacement System',
  description: 'Multi-entity accounting preparation system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-page text-ink-primary font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
