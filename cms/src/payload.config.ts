import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Templates } from './collections/Templates'
import { Articles } from './collections/Articles'
import { CostLog } from './collections/CostLog'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      afterNavLinks: ['/components/ops/ExtraOpsNavLinks#ExtraOpsNavLinks'],
      views: {
        articleBoard: {
          Component: '/components/ops/ArticleBoardView#ArticleBoardView',
          path: '/ops/articles',
          exact: true,
          meta: { title: 'Article board' },
        },
        articleReview: {
          Component: '/components/ops/ArticleReviewView#ArticleReviewView',
          path: '/ops/articles/:id',
          meta: { title: 'Article review' },
        },
        opsReports: {
          Component: '/components/ops/ReportsView#ReportsView',
          path: '/ops/reports',
          exact: true,
          meta: { title: 'Reports' },
        },
        templateConfig: {
          Component: '/components/ops/TemplateConfigView#TemplateConfigView',
          path: '/ops/templates',
          exact: true,
          meta: { title: 'Templates' },
        },
      },
    },
  },
  collections: [Users, Media, Templates, Articles, CostLog],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
