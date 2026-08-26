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
import { ArticleAudit } from './collections/ArticleAudit'
import { BrandVoices } from './collections/BrandVoices'
import { BrandVoiceFiles } from './collections/BrandVoiceFiles'
import { GovernanceAudit } from './collections/GovernanceAudit'
import { EvidenceSources } from './collections/EvidenceSources'
import { EvidenceSourceCandidates } from './collections/EvidenceSourceCandidates'
import { CorpusSnapshots } from './collections/CorpusSnapshots'
import { InformationGainRuns } from './collections/InformationGainRuns'
import { PipelineRuns } from './collections/PipelineRuns'
import { InformationGainPolicy } from './globals/InformationGainPolicy'
import { LlmSettings } from './globals/LlmSettings'
import { ContentRunTask } from './jobs/contentRun'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Dev convenience: PAYLOAD_AUTO_LOGIN=true in cms/.env skips the admin login
// form by signing in as the seeded admin. Never honoured in production.
const autoLogin =
  process.env.PAYLOAD_AUTO_LOGIN === 'true' && process.env.NODE_ENV !== 'production'
    ? { email: process.env.PAYLOAD_AUTO_LOGIN_EMAIL || 'admin@datum.local' }
    : false

export default buildConfig({
  admin: {
    user: Users.slug,
    autoLogin,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      afterNavLinks: ['/components/ops/ExtraOpsNavLinks#ExtraOpsNavLinks'],
      views: {
        dashboard: {
          Component: '/components/ops/OnboardingDashboardView#OnboardingDashboardView',
          path: '/',
          exact: true,
          meta: { title: 'Workspace setup' },
        },
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
        brandVoice: {
          Component: '/components/ops/BrandVoiceView#BrandVoiceView',
          path: '/ops/governance/brand-voice',
          exact: true,
          meta: { title: 'Brand voice' },
        },
      },
    },
  },
  collections: [
    Users,
    Media,
    Templates,
    Articles,
    CostLog,
    ArticleAudit,
    BrandVoices,
    BrandVoiceFiles,
    GovernanceAudit,
    EvidenceSources,
    EvidenceSourceCandidates,
    CorpusSnapshots,
    InformationGainRuns,
    PipelineRuns,
  ],
  globals: [LlmSettings, InformationGainPolicy],
  jobs: {
    tasks: [ContentRunTask],
    enableConcurrencyControl: true,
    processingOrder: 'createdAt',
    autoRun:
      process.env.NODE_ENV === 'development'
        ? [{ cron: '*/2 * * * * *', queue: 'content', limit: 1 }]
        : [],
  },
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
