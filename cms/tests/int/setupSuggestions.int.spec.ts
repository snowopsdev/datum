import { randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import { beforeAll, afterAll, it, expect, vi } from 'vitest'
import config from '@/payload.config'
import { BRAND_VOICE_FIXTURE } from '@/lib/brandVoiceFixture'
import { brandVoiceContentOf } from '@/lib/brandVoice'
import {
  evidenceBankContentOf,
  evidenceBankToPrompt,
  isClaimComplete,
} from '@/lib/tenant/evidenceBank'
import { plainTextToLexical } from '@/lib/lexicalHtml'
import { collectSetupSuggestions } from '@/lib/setupSuggestions/collect'
import { CollectSetupSuggestionsTask } from '@/jobs/collectSetupSuggestions'
let payload: Payload
let user: { id: number; email: string; collection: 'users' } | null
let voiceId: number
let bankOriginal: unknown
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/requireUser', () => ({
  requireUser: async () => {
    if (!user) throw new Error('Unauthorized')
    return { payload, user }
  },
}))
const { acceptSuggestionAction, dismissSuggestionAction } =
  await import('@/components/ops/suggestionActions')
const { saveBrandVoiceDraftAction } = await import('@/components/ops/brandVoiceActions')
const { saveEvidenceBankAction } = await import('@/components/ops/tenantActions')
beforeAll(async () => {
  payload = await getPayload({ config: await config })
  bankOriginal = await payload.findGlobal({ slug: 'evidence-bank', overrideAccess: true })
  const doc = await payload.create({
    collection: 'users',
    data: { email: `suggestions-${randomUUID()}@example.com`, password: 'test' },
    overrideAccess: true,
  })
  user = { id: doc.id, email: doc.email, collection: 'users' }
  const voice = await payload.create({
    collection: 'brand-voices',
    data: {
      ...BRAND_VOICE_FIXTURE,
      name: `Suggestion voice ${randomUUID()}`,
      source: 'onboarding',
      status: 'active',
    },
    overrideAccess: true,
    user,
  })
  voiceId = voice.id
})
afterAll(async () => {
  if (user) await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  await payload.update({
    collection: 'brand-voices',
    id: voiceId,
    data: { status: 'archived' },
    overrideAccess: true,
  })
  await payload.updateGlobal({
    slug: 'evidence-bank',
    data: bankOriginal as never,
    overrideAccess: true,
  })
})
const find = async (signature: string) =>
  (
    await payload.find({
      collection: 'setup-suggestions',
      where: { signature: { equals: signature } },
      limit: 1,
      overrideAccess: true,
    })
  ).docs[0]
const make = async (
  kind: 'banned_word' | 'not_trait' | 'unbacked_claim' | 'rejected_ref',
  proposal: Record<string, unknown>,
) =>
  payload.create({
    collection: 'setup-suggestions',
    overrideAccess: true,
    data: {
      kind,
      signature: `${kind}:test:${randomUUID()}`,
      target: kind === 'banned_word' || kind === 'not_trait' ? 'brand-voice' : 'evidence-bank',
      proposal,
      count: 3,
      status: 'open',
      occurrences: [],
    },
  })
const testPhrase =
  'crystal ' +
  randomUUID()
    .replaceAll('-', '')
    .replace(/\d/g, (n) => String.fromCharCode(97 + Number(n)))
const signalArticle = async (phrase = testPhrase) => {
  const article = await payload.create({
    collection: 'articles',
    overrideAccess: true,
    data: {
      keyword: `coffee ${randomUUID()}`,
      title: 'Clean instructions',
      status: 'published',
      body: plainTextToLexical('Ordinary guidance.') as never,
    },
  })
  await payload.create({
    collection: 'article-audit',
    overrideAccess: true,
    data: {
      article: article.id,
      event: 'generate_completed',
      summary: 'generate completed',
      actor: 'pipeline',
      actorType: 'pipeline',
      details: { output: { body: plainTextToLexical(`${phrase} advice. Ordinary guidance.`) } },
    },
  })
  return article
}
it('the job creates open suggestions, no new history changes nothing, and later history increments count', async () => {
  await signalArticle()
  await signalArticle()
  await signalArticle()
  const handler = CollectSetupSuggestionsTask.handler as Exclude<
    typeof CollectSetupSuggestionsTask.handler,
    string
  >
  await handler({ input: {}, req: { payload } } as never)
  const row = await find('banned_word:' + testPhrase)
  expect(row?.status).toBe('open')
  expect(row?.count).toBe(3)
  expect(await collectSetupSuggestions(payload)).toEqual({ created: 0, updated: 0, obsolete: 0 })
  await signalArticle()
  await collectSetupSuggestions(payload)
  expect((await find('banned_word:' + testPhrase)).count).toBe(4)
  await dismissSuggestionAction(row.id, 'Keep editor discretion')
  await signalArticle()
  await collectSetupSuggestions(payload)
  expect((await find('banned_word:' + testPhrase)).status).toBe('dismissed')
})
it('accept appends one row to the active voice, writes a decision audit, and does not reopen', async () => {
  const phrase = `unhelpful ${randomUUID().replaceAll('-', '')}`
  const row = await make('banned_word', { phrase })
  expect(await acceptSuggestionAction(row.id)).toEqual({ ok: true })
  expect((await acceptSuggestionAction(row.id)).ok).toBe(false)
  const voice = await payload.findByID({
    collection: 'brand-voices',
    id: voiceId,
    overrideAccess: true,
  })
  expect(voice.bannedWords?.filter((w) => w.word === phrase)).toHaveLength(1)
  const audit = await payload.find({
    collection: 'governance-audit',
    where: { event: { equals: 'setup_suggestion_accepted' } },
    overrideAccess: true,
    pagination: false,
  })
  expect(
    audit.docs.some((r) => (r.details as { suggestionId?: number })?.suggestionId === row.id),
  ).toBe(true)
})
it('accepting as verified adds incomplete evidence that never reaches the writer; rejected adds an R ref', async () => {
  const claim = `Readers save 40 beans ${randomUUID()}`
  const row = await make('unbacked_claim', { claim })
  expect(await acceptSuggestionAction(row.id)).toEqual({ ok: true })
  const bank = evidenceBankContentOf(
    await payload.findGlobal({ slug: 'evidence-bank', overrideAccess: true }),
  )
  const added = bank.verifiedClaims.find((c) => c.claim === claim)!
  expect(added.verificationDepth).toBe('self_reported')
  expect(isClaimComplete(added)).toBe(false)
  expect(
    evidenceBankToPrompt(bank, { asOf: '2026-10-07', surface: 'web', companyName: 'Coffee' }),
  ).not.toContain(claim)
  const rejected = await make('unbacked_claim', { claim: `Impossible ${randomUUID()}` })
  expect((await acceptSuggestionAction(rejected.id, { evidenceAs: 'rejected' })).ok).toBe(false)
  expect(
    await acceptSuggestionAction(rejected.id, { evidenceAs: 'rejected', reason: 'No support' }),
  ).toEqual({ ok: true })
  const newBank = evidenceBankContentOf(
    await payload.findGlobal({ slug: 'evidence-bank', overrideAccess: true }),
  )
  expect(newBank.rejectedClaims.find((c) => c.reason === 'No support')?.ref).toMatch(/^R\d+$/)
})
it('dismiss records the operator and reason; an unsigned caller cannot decide or write through the API', async () => {
  const row = await make('banned_word', { phrase: 'Test phrase' })
  expect(await dismissSuggestionAction(row.id, 'Not a useful boundary')).toEqual({ ok: true })
  const decided = await payload.findByID({
    collection: 'setup-suggestions',
    id: row.id,
    overrideAccess: true,
  })
  expect(decided.decidedBy).toBe(user!.email)
  expect(decided.decisionReason).toBe('Not a useful boundary')
  const saved = user
  user = null
  expect((await acceptSuggestionAction(row.id)).ok).toBe(false)
  expect((await dismissSuggestionAction(row.id)).ok).toBe(false)
  user = saved
  await expect(
    payload.update({
      collection: 'setup-suggestions',
      id: row.id,
      data: { status: 'open' },
      overrideAccess: false,
      user: user!,
    }),
  ).rejects.toMatchObject({ status: 403 })
})
it('a satisfied open suggestion becomes obsolete even with no new history', async () => {
  const row = await make('banned_word', { phrase: 'synergy' })
  await collectSetupSuggestions(payload)
  expect(
    (await payload.findByID({ collection: 'setup-suggestions', id: row.id, overrideAccess: true }))
      .status,
  ).toBe('obsolete')
})
it('trait acceptance opens an editor and is recorded only after a changed boundary is saved', async () => {
  const voice = await payload.findByID({
    collection: 'brand-voices',
    id: voiceId,
    overrideAccess: true,
  })
  const content = brandVoiceContentOf(voice)
  const row = await make('not_trait', {
    trait: 'Sarcastic',
    previousBoundaryNote: content.notTraits.find((t) => t.trait === 'Sarcastic')?.boundaryNote,
  })
  const result = await acceptSuggestionAction(row.id)
  expect(result.ok && result.editorHref).toContain(`suggestionId=${row.id}`)
  expect(
    (await payload.findByID({ collection: 'setup-suggestions', id: row.id, overrideAccess: true }))
      .status,
  ).toBe('open')
  await saveBrandVoiceDraftAction(
    voiceId,
    {
      ...content,
      notTraits: content.notTraits.map((t) =>
        t.trait === 'Sarcastic'
          ? { ...t, boundaryNote: 'Never mock a reader’s beginner mistakes.' }
          : t,
      ),
    },
    row.id,
  )
  expect(
    (await payload.findByID({ collection: 'setup-suggestions', id: row.id, overrideAccess: true }))
      .status,
  ).toBe('accepted')
})

it('replacement acceptance stays open until the evidence editor saves replacement text', async () => {
  const bank = evidenceBankContentOf(
    await payload.findGlobal({ slug: 'evidence-bank', overrideAccess: true }),
  )
  const claim = `Rejected phrase ${randomUUID()}`
  const saved = await saveEvidenceBankAction({
    ...bank,
    rejectedClaims: [
      ...bank.rejectedClaims,
      { ref: '', claim, status: 'rejected', reason: 'Unsupported', replacement: '' },
    ],
  })
  expect(saved.ok).toBe(true)
  if (!saved.ok) return
  const ref = saved.saved.rejectedClaims.find((c) => c.claim === claim)!.ref
  const row = await make('rejected_ref', { ref })
  expect((await acceptSuggestionAction(row.id)).ok).toBe(true)
  expect(
    (await payload.findByID({ collection: 'setup-suggestions', id: row.id, overrideAccess: true }))
      .status,
  ).toBe('open')
  expect(
    (
      await saveEvidenceBankAction(
        {
          ...saved.saved,
          rejectedClaims: saved.saved.rejectedClaims.map((c) =>
            c.ref === ref ? { ...c, replacement: 'State only the measured testing method.' } : c,
          ),
        },
        row.id,
      )
    ).ok,
  ).toBe(true)
  expect(
    (await payload.findByID({ collection: 'setup-suggestions', id: row.id, overrideAccess: true }))
      .status,
  ).toBe('accepted')
})
it('QA signals accumulate across scans and repeated passes do not increase the article count', async () => {
  const claim = `We save 40 beans in our workshop ${randomUUID()}`
  const ids: number[] = []
  for (let i = 0; i < 3; i++) {
    const article = await signalArticle('carefully chosen')
    ids.push(article.id)
    await payload.create({
      collection: 'article-audit',
      overrideAccess: true,
      data: {
        article: article.id,
        event: 'qa_completed',
        summary: 'qa completed',
        actor: 'pipeline',
        actorType: 'pipeline',
        details: {
          output: {
            qaResults: {
              qualitativeReview: {
                notTraitViolations: [{ trait: 'Academic', excerpt: 'An opaque formula.' }],
              },
              evidenceCheck: {
                claims: [{ excerpt: claim, kind: 'first_party', status: 'unbacked' }],
              },
            },
          },
        },
      },
    })
    await collectSetupSuggestions(payload)
  }
  const suggestions = await payload.find({
    collection: 'setup-suggestions',
    pagination: false,
    overrideAccess: true,
  })
  expect(
    suggestions.docs.some(
      (r) =>
        r.kind === 'not_trait' &&
        (r.count ?? 0) >= 3 &&
        (r.proposal as { trait?: string }).trait === 'Academic',
    ),
  ).toBe(true)
  expect(
    suggestions.docs.some(
      (r) =>
        r.kind === 'unbacked_claim' &&
        (r.count ?? 0) >= 3 &&
        (r.proposal as { claim?: string }).claim === claim,
    ),
  ).toBe(true)
})
