import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // Next 16 refuses to serve dev-only resources (`/_next/hmr`, the dev
  // client's chunks) to a host it does not recognise, and the admin panel
  // then streams a shell that never hydrates. The E2E suites drive
  // `http://127.0.0.1:3000`, which is a different host string from the
  // `localhost` the dev server advertises — that mismatch is what left
  // `/admin/login` permanently blank under Playwright. Development only:
  // `next build` ignores it.
  allowedDevOrigins: ['127.0.0.1'],
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
  // The keyword-first discovery page and the kanban board were replaced by
  // "New content" and the content list. Their admin views are gone; these
  // keep old bookmarks and links working. Temporary, not permanent, in case
  // either path is reused for something else later.
  async redirects() {
    return [
      {
        source: '/admin/ops/topics',
        destination: '/admin/ops/new',
        permanent: false,
      },
      {
        source: '/admin/ops/articles',
        destination: '/admin/ops/content',
        permanent: false,
      },
      // Brand voice moved in with the other workspace assets it is edited
      // alongside. Same view, one surface, old bookmarks still land.
      {
        source: '/admin/ops/governance/brand-voice',
        destination: '/admin/ops/setup/brand-voice',
        permanent: false,
      },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
