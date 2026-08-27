import 'dotenv/config'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { BRAND_VOICE_FIXTURE } from './lib/brandVoiceFixture'
import type { Template } from './payload-types'

type RichText = NonNullable<Template['outline']>
type Node = RichText['root']['children'][number]

const textNode = (text: string): Node => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
})

const heading = (tag: 'h2' | 'h3', text: string): Node => ({
  children: [textNode(text)],
  direction: 'ltr',
  format: '',
  indent: 0,
  tag,
  type: 'heading',
  version: 1,
})

const paragraph = (text: string): Node => ({
  children: [textNode(text)],
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  type: 'paragraph',
  version: 1,
})

const richText = (...children: Node[]): RichText => ({
  root: {
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

type TemplateSeed = Omit<Template, 'id' | 'createdAt' | 'updatedAt'>

const headingStructureRules =
  'Exactly one H1 (the article title). H2s for major sections in the order given by the outline. H3s only nested under an H2. No skipped heading levels. Headings in sentence case.'

const templates: TemplateSeed[] = [
  {
    name: 'Listicle',
    intent: 'A ranked list of the best options, with how they were chosen',
    outline: richText(
      heading('h2', 'Introduction'),
      paragraph(
        'Two or three short paragraphs. State what the list covers, who it is for, and the criteria used to pick the items. No H2 heading label needed if the intro directly follows the title.',
      ),
      heading('h2', 'One H2 per list item, numbered'),
      paragraph(
        'Each item gets its own H2 in the form "1. Item name". Under each H2: what it is, why it made the list, and one concrete detail (price, spec, or example). Optional H3s for "Pros" and "Cons" on product-style lists.',
      ),
      heading('h2', 'How we chose'),
      paragraph('One short section explaining the selection criteria and any testing or sources used.'),
      heading('h2', 'Conclusion'),
      paragraph('Summarize the top pick or the main takeaway and point the reader to a next step.'),
    ),
    dos: [
      { text: 'Number every list item and keep the promised count in the title accurate' },
      { text: 'Lead each item with the most useful fact, not background' },
      { text: 'Keep item sections roughly equal in length' },
      { text: 'Include at least one concrete detail (number, price, spec) per item' },
      { text: 'State the selection criteria explicitly' },
    ],
    donts: [
      { text: 'Do not pad the list with weak items to hit a round number' },
      { text: 'Do not bury the item name mid-paragraph; it belongs in the H2' },
      { text: 'Do not repeat the same opening sentence pattern across items' },
      { text: 'Do not rank items without saying what the ranking is based on' },
    ],
    requiredSections: [{ heading: 'How we chose' }, { heading: 'Conclusion' }],
    seoSpec: {
      titleTagMaxLength: 60,
      metaDescriptionMaxLength: 160,
      headingStructureRules,
      faqRequired: false,
      ogTagsRequired: true,
    },
  },
  {
    name: 'How-To',
    intent: 'A step-by-step guide that gets the reader to a working result',
    outline: richText(
      heading('h2', 'Introduction'),
      paragraph(
        'State the task, who it is for, and what the reader will have when done. Mention expected time and difficulty in one sentence.',
      ),
      heading('h2', 'What you need'),
      paragraph('A bulleted list of prerequisites: tools, materials, accounts, or prior knowledge.'),
      heading('h2', 'Step-by-step instructions'),
      paragraph(
        'One H3 per step in the form "Step 1: Verb phrase". Each step: one action, why it matters if not obvious, and what the reader should see when it worked.',
      ),
      heading('h3', 'Step 1: First action'),
      heading('h3', 'Step 2: Next action'),
      heading('h2', 'Common mistakes'),
      paragraph('Two to four pitfalls and how to avoid or recover from each.'),
      heading('h2', 'FAQ'),
      paragraph('Three to six questions readers actually ask about this task, each answered in two to four sentences.'),
    ),
    dos: [
      { text: 'Start every step with an imperative verb' },
      { text: 'Keep one action per step' },
      { text: 'Tell the reader what success looks like after key steps' },
      { text: 'List all prerequisites before the first step' },
      { text: 'Include realistic time estimates' },
      { text: 'Answer FAQ questions directly in the first sentence' },
    ],
    donts: [
      { text: 'Do not combine multiple actions into one step' },
      { text: 'Do not assume tools or setup that were not listed in prerequisites' },
      { text: 'Do not use vague steps like "configure the settings" without saying which' },
      { text: 'Do not skip failure cases; say what to do when a step does not work' },
    ],
    requiredSections: [{ heading: 'What you need' }, { heading: 'Step-by-step instructions' }, { heading: 'Common mistakes' }, { heading: 'FAQ' }],
    seoSpec: {
      titleTagMaxLength: 60,
      metaDescriptionMaxLength: 160,
      headingStructureRules,
      faqRequired: true,
      faqMinQuestions: 3,
      faqMaxQuestions: 6,
      ogTagsRequired: true,
    },
  },
  {
    name: 'Comparison',
    intent: 'A head-to-head comparison that ends with a clear verdict',
    outline: richText(
      heading('h2', 'Introduction'),
      paragraph(
        'Name the options being compared, who the comparison is for, and the one-sentence verdict up front.',
      ),
      heading('h2', 'Quick verdict'),
      paragraph('A short table or list: which option wins for which kind of user.'),
      heading('h2', 'Head-to-head comparison'),
      paragraph(
        'One H3 per criterion (price, features, ease of use, support). Under each: how each option performs and which wins on that criterion.',
      ),
      heading('h3', 'Price'),
      heading('h3', 'Features'),
      heading('h3', 'Ease of use'),
      heading('h2', 'Who should pick which'),
      paragraph('Map two or three user profiles to the option that fits each.'),
      heading('h2', 'Conclusion'),
      paragraph('Restate the verdict and the single most decisive difference.'),
    ),
    dos: [
      { text: 'Give the verdict in the introduction, not only at the end' },
      { text: 'Compare on the same criteria for every option' },
      { text: 'Declare a winner per criterion, or say it is a tie and why' },
      { text: 'Use concrete numbers for price and specs' },
      { text: 'Say who each option is right for' },
    ],
    donts: [
      { text: 'Do not hedge every criterion; commit to a call where the evidence supports one' },
      { text: 'Do not compare on criteria only one option can win' },
      { text: 'Do not hide pricing differences in prose; make them scannable' },
    ],
    requiredSections: [{ heading: 'Quick verdict' }, { heading: 'Head-to-head comparison' }, { heading: 'Who should pick which' }, { heading: 'Conclusion' }],
    seoSpec: {
      titleTagMaxLength: 60,
      metaDescriptionMaxLength: 160,
      headingStructureRules,
      faqRequired: false,
      ogTagsRequired: true,
    },
  },
]

const upsertTemplates = async (payload: Payload): Promise<void> => {
  for (const data of templates) {
    const existing = await payload.find({
      collection: 'templates',
      where: { name: { equals: data.name } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      await payload.update({ collection: 'templates', id: existing.docs[0].id, data })
      payload.logger.info(`Updated template "${data.name}"`)
    } else {
      await payload.create({ collection: 'templates', data })
      payload.logger.info(`Created template "${data.name}"`)
    }
  }
}

/**
 * The evidence domains the information-gain stage trusts out of the box.
 *
 * Seeded unconditionally, unlike the brand voice: the stage's numeric integrity
 * floor is 0.95 and an unclassified domain is capped at 0.75, so with an empty
 * table every materially novel number in a draft is blocked — including the
 * demo pipeline's. These three are the sources the mock verifier fixture cites.
 */
const evidenceSources: { domain: string; qualityClass: 'primary'; note: string }[] = [
  {
    domain: 'sca.coffee',
    qualityClass: 'primary',
    note: 'Specialty Coffee Association — publishes its own research and standards.',
  },
  {
    domain: 'baristahustle.com',
    qualityClass: 'primary',
    note: 'Barista Hustle — original coffee-extraction testing and course material.',
  },
  {
    domain: 'homegrounds.co',
    qualityClass: 'primary',
    note: 'Home Grounds — hands-on equipment and freshness testing.',
  },
]

const upsertEvidenceSources = async (payload: Payload): Promise<void> => {
  for (const data of evidenceSources) {
    const existing = await payload.find({
      collection: 'evidence-sources',
      where: { domain: { equals: data.domain } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'evidence-sources',
        id: existing.docs[0].id,
        data: { ...data, active: true },
      })
      payload.logger.info(`Updated evidence source "${data.domain}"`)
    } else {
      await payload.create({ collection: 'evidence-sources', data: { ...data, active: true } })
      payload.logger.info(`Created evidence source "${data.domain}"`)
    }
  }
}

const upsertAdminUser = async (payload: Payload): Promise<void> => {
  const email = 'admin@datum.local'
  const password = process.env.SEED_ADMIN_PASSWORD || 'datum-dev-password'
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    await payload.update({ collection: 'users', id: existing.docs[0].id, data: { password } })
    payload.logger.info(`Updated user ${email}`)
  } else {
    await payload.create({ collection: 'users', data: { email, password } })
    payload.logger.info(`Created user ${email}`)
  }
}

/**
 * Opt-in only (`npm run seed -- --with-brand-voice`): the default seed leaves
 * no brand voice so the admin's onboarding empty state stays reachable.
 * Activating runs the single-active cascade, so re-seeding never leaves two
 * active records.
 */
const upsertBrandVoice = async (payload: Payload): Promise<void> => {
  const data = {
    ...BRAND_VOICE_FIXTURE,
    status: 'active' as const,
    source: 'onboarding' as const,
    onboardingStep: 9,
  }
  const existing = await payload.find({
    collection: 'brand-voices',
    where: { name: { equals: data.name } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    await payload.update({ collection: 'brand-voices', id: existing.docs[0].id, data })
    payload.logger.info(`Updated brand voice "${data.name}"`)
  } else {
    await payload.create({ collection: 'brand-voices', data })
    payload.logger.info(`Created brand voice "${data.name}"`)
  }
}

const seed = async (): Promise<void> => {
  const payload = await getPayload({ config })
  await upsertTemplates(payload)
  await upsertEvidenceSources(payload)
  await upsertAdminUser(payload)
  if (process.argv.includes('--with-brand-voice')) {
    await upsertBrandVoice(payload)
  }
  const { totalDocs } = await payload.count({ collection: 'templates' })
  payload.logger.info(`Seed complete. Template count: ${totalDocs}`)
  process.exit(0)
}

void seed()
