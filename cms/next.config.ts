import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // Brand-guide uploads (pdf/docx) go through a server action; the default
  // 1 MB body limit is too small for a real PDF.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Node-only parsers used by cms/src/lib/extractText.ts; keep them out of the bundle.
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    // npm workspaces hoist node_modules to the repo root; without this Turbopack
    // resolves from cms/ and cannot find the next package
    root: path.resolve(dirname, '..'),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
