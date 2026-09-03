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
import { Icps } from './collections/Icps'
import { EvidenceSources } from './collections/EvidenceSources'
import { EvidenceSourceCandidates } from './collections/EvidenceSourceCandidates'
import { CorpusSnapshots } from './collections/CorpusSnapshots'
import { TopicSearches } from './collections/TopicSearches'
import { InformationGainRuns } from './collections/InformationGainRuns'
import { PipelineRuns } from './collections/PipelineRuns'
import { EvidenceBank } from './globals/EvidenceBank'
import { InformationGainPolicy } from './globals/InformationGainPolicy'
import { LlmSettings } from './globals/LlmSettings'
import { Positioning } from './globals/Positioning'
import { WebhookSettings } from './globals/WebhookSettings'
import { WorkspaceProfile } from './globals/WorkspaceProfile'
import { ContentRunTask } from './jobs/contentRun'
import { PublishDueTask } from './jobs/publishDue'
import { WebhookDeliverTask } from './jobs/webhookDeliver'

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
      // A provider is the only slot that wraps every admin route, which is what
      // the run bar needs: a live run outlasts the page you started it from.
      providers: ['/components/ops/RunBarProvider#RunBarProvider'],
      views: {
        dashboard: {
          Component: '/components/ops/OnboardingDashboardView#OnboardingDashboardView',
          path: '/',
          exact: true,
          meta: { title: 'Workspace setup' },
        },
        newContent: {
          Component: '/components/ops/NewContentView#NewContentView',
          path: '/ops/new',
          exact: true,
          meta: { title: 'New content' },
        },
        // The keyword-first discovery page this replaced. Redirects so bookmarks work.
        topicDiscovery: {
          Component: '/components/ops/TopicDiscoveryView#TopicDiscoveryView',
          path: '/ops/topics',
          exact: true,
          meta: { title: 'New content' },
        },
        content: {
          Component: '/components/ops/ContentListView#ContentListView',
          path: '/ops/content',
          exact: true,
          meta: { title: 'Content' },
        },
        // The kanban board this replaced. Kept as a redirect so bookmarks work.
        articleBoard: {
          Component: '/components/ops/ArticleBoardView#ArticleBoardView',
          path: '/ops/articles',
          exact: true,
          meta: { title: 'Content' },
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
        sourceReview: {
          Component: '/components/ops/SourceReviewView#SourceReviewView',
          path: '/ops/governance/source-review',
          exact: true,
          meta: { title: 'Source review' },
        },
        // The setup hub and the four tenant-asset editors. The hub is the same
        // component `/admin` renders before onboarding is finished; it stays
        // here afterwards because a workspace's domain, audiences, position,
        // and evidence keep changing long after the first piece.
        setup: {
          Component: '/components/ops/SetupView#SetupView',
          path: '/ops/setup',
          exact: true,
          meta: { title: 'Workspace setup' },
        },
        setupWorkspace: {
          Component: '/components/ops/SetupWorkspaceView#SetupWorkspaceView',
          path: '/ops/setup/workspace',
          exact: true,
          meta: { title: 'Workspace' },
        },
        setupAudiences: {
          Component: '/components/ops/IcpListView#IcpListView',
          path: '/ops/setup/audiences',
          exact: true,
          meta: { title: 'Audiences' },
        },
        // Also serves `/ops/setup/audiences/new`, which is an audience that
        // does not exist until its first save.
        setupAudience: {
          Component: '/components/ops/IcpEditorView#IcpEditorView',
          path: '/ops/setup/audiences/:id',
          meta: { title: 'Audience' },
        },
        setupPositioning: {
          Component: '/components/ops/PositioningView#PositioningView',
          path: '/ops/setup/positioning',
          exact: true,
          meta: { title: 'Positioning' },
        },
        setupEvidence: {
          Component: '/components/ops/EvidenceBankView#EvidenceBankView',
          path: '/ops/setup/evidence',
          exact: true,
          meta: { title: 'Evidence bank' },
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
    Icps,
    GovernanceAudit,
    EvidenceSources,
    EvidenceSourceCandidates,
    CorpusSnapshots,
    TopicSearches,
    InformationGainRuns,
    PipelineRuns,
  ],
  globals: [
    WorkspaceProfile,
    Positioning,
    EvidenceBank,
    LlmSettings,
    InformationGainPolicy,
    WebhookSettings,
  ],
  jobs: {
    tasks: [ContentRunTask, WebhookDeliverTask, PublishDueTask],
    enableConcurrencyControl: true,
    processingOrder: 'createdAt',
    // Production runs no queues in-process; the external scheduler calls
    // `payload jobs:run --queue content --limit 1` and needs lines for
    // `--queue webhooks` and `--queue scheduled --handle-schedules`
    // (see docs/operations.md).
    autoRun:
      process.env.NODE_ENV === 'development'
        ? [
            { cron: '*/2 * * * * *', queue: 'content', limit: 1 },
            { cron: '*/2 * * * * *', queue: 'webhooks', limit: 5 },
            { cron: '*/10 * * * * *', queue: 'scheduled', limit: 1 },
          ]
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
    // Dev push stays on for `next dev` and the pipeline CLI, but not under
    // vitest. Tests run on migration-built databases, so push has nothing
    // legitimate to do there — and what it *does* do is race: the
    // `evidence_source_candidates.resolved_source` FK name is 68 characters,
    // Postgres keeps 63, so drizzle sees a mismatch on every boot and emits a
    // DROP + ADD of the same constraint. One process survives that; two vitest
    // workers booting together do not (the second DROP finds nothing). Turning
    // push off in tests also removes the interactive "create enum?" prompt that
    // used to hang the suite after a schema change. Playwright has the same
    // problem doubled: parallel e2e workers each boot Payload for seeding, so
    // the test:e2e script sets DISABLE_DEV_PUSH to keep them out of the race.
    push: process.env.VITEST !== 'true' && process.env.DISABLE_DEV_PUSH !== 'true',
  }),
  sharp,
  plugins: [],
})
