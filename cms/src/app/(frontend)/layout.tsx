import type { Metadata } from 'next'
import React from 'react'

import { getMetadataBase } from '@/lib/siteUrl'
import './styles.css'

const metadataBase = getMetadataBase()

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  description:
    'SEO content pipeline built on Payload CMS — research, generate, and QA articles end to end.',
  title: 'Datum',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
