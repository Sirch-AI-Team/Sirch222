import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sirch - AI-Powered HackerNews',
  description: 'Real-time HackerNews stories with AI-generated summaries',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}