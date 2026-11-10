import { randomUUID } from 'node:crypto'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { BRAND_VOICE_FIXTURE } from '@/lib/brandVoiceFixture'

/**
 * Accepting a suggestion rewrites the whole evidence bank or brand voice from
 * what was read a moment earlier. A save that lands in between must not be
 * overwritten.
 */

let payload: Payload
let user: { id: number; email: string; collection: 'users' }
let voiceId: number
let bankOriginal: unknown
// Runs right after the assets are read, i.e. inside the window.
const between = vi.hoisted(() => ({ run: null as null | (() => Promise<void>) }))
// Lets one test make the brand-voice save refuse, the way a gate would.
const voiceSave = vi.hoisted(() => ({ refuse: null as null | string }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/requireUser', () => ({ requireUser: async () => ({ payload, user }) }))
vi.mock('@/lib/setupSuggestions/collect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/setupSuggestions/collect')>()
  return {
    ...actual,
    suggestionAssets: async (p: Payload) => {
      const assets = await actual.suggestionAssets(p)
      await between.run?.()
      return assets
    },
  }
})

vi.mock('@/components/ops/brandVoiceActions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ops/brandVoiceActions')>()
  return {
    ...actual,
    saveBrandVoiceDraftAction: (async (...args: Parameters<typeof actual.saveBrandVoiceDraftAction>) =>
      voiceSave.refuse
        ? { ok: false, error: voiceSave.refuse }
        : actual.saveBrandVoiceDraftAction(...args)) as typeof actual.saveBrandVoiceDraftAction,
  }
})

const { acceptSuggestionAction } = await import('@/components/ops/suggestionActions')
const { saveEvidenceBankAction } = await import('@/components/ops/tenantActions')

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  bankOriginal = await payload.findGlobal({ slug: 'evidence-bank', overrideAccess: true })
  const doc = await payload.create({
    collection: 'users',
    data: { email: `suggestion-concurrency-${randomUUID()}@example.com`, password: 'test' },
    overrideAccess: true,
  })
  user = { id: doc.id, email: doc.email, collection: 'users' }
  const voice = await payload.create({
    collection: 'brand-voices',
    data: {
      ...BRAND_VOICE_FIXTURE,
      name: `Concurrency voice ${randomUUID()}`,
      source: 'onboarding',
      status: 'active',
    },
    overrideAccess: true,
    user,
  })
  voiceId = voice.id
})

beforeEach(() => {
  between.run = null
  voiceSave.refuse = null
})

afterAll(async () => {
  await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
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

const suggest = (kind: 'banned_word' | 'unbacked_claim', proposal: Record<string, unknown>) =>
  payload.create({
    collection: 'setup-suggestions',
    overrideAccess: true,
    data: {
      kind,
      signature: `${kind}:concurrency:${randomUUID()}`,
      target: kind === 'banned_word' ? 'brand-voice' : 'evidence-bank',
      proposal,
      count: 3,
      status: 'open',
      occurrences: [],
    },
  })

it('does not overwrite an evidence bank saved between the read and the write', async () => {
  const claim = `Claim ${randomUUID()}`
  const row = await suggest('unbacked_claim', { claim })
  between.run = async () => {
    // A colleague saves the bank in the window.
    const saved = await saveEvidenceBankAction({
      verifiedClaims: [],
      rejectedClaims: [],
      facts: [
        { ref: '', fact: 'Added by a colleague', source: 'them', owner: '', lastConfirmedAt: '' },
      ],
    })
    if (!saved.ok) throw new Error(saved.error)
  }

  const result = await acceptSuggestionAction(row.id, { evidenceAs: 'verified' })

  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.error).toContain('Someone else saved this')
  const bank = (await payload.findGlobal({
    slug: 'evidence-bank',
    depth: 0,
    overrideAccess: true,
  })) as {
    facts?: { fact: string }[]
    verifiedClaims?: { claim: string }[]
  }
  expect(bank.facts?.map((f) => f.fact)).toContain('Added by a colleague')
  expect(bank.verifiedClaims?.map((c) => c.claim) ?? []).not.toContain(claim)
  const after = await payload.findByID({
    collection: 'setup-suggestions',
    id: row.id,
    overrideAccess: true,
  })
  expect(after.status).toBe('open')
})

it('adds the claim when nothing changed in between', async () => {
  const claim = `Claim ${randomUUID()}`
  const row = await suggest('unbacked_claim', { claim })
  const result = await acceptSuggestionAction(row.id, { evidenceAs: 'verified' })
  expect(result.ok).toBe(true)
  const bank = (await payload.findGlobal({
    slug: 'evidence-bank',
    depth: 0,
    overrideAccess: true,
  })) as {
    verifiedClaims?: { claim: string }[]
  }
  expect(bank.verifiedClaims?.map((c) => c.claim)).toContain(claim)
})

it('does not overwrite a brand voice saved between the read and the write', async () => {
  const phrase = `phrase ${randomUUID().replaceAll('-', '')}`
  const row = await suggest('banned_word', { phrase })
  between.run = async () => {
    await payload.update({
      collection: 'brand-voices',
      id: voiceId,
      data: { name: `Renamed by a colleague ${randomUUID()}` },
      overrideAccess: true,
    })
  }

  const result = await acceptSuggestionAction(row.id)

  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.error).toContain('Someone else saved this')
  const voice = await payload.findByID({
    collection: 'brand-voices',
    id: voiceId,
    depth: 0,
    overrideAccess: true,
  })
  expect(voice.name).toContain('Renamed by a colleague')
  expect(JSON.stringify(voice.bannedWords ?? [])).not.toContain(phrase)
})

// The brand-voice save answers a refusal as a value, not a throw. Accepting must
// pass it on and leave the suggestion open, not mark it accepted with the word
// never written.
it('leaves a banned-word suggestion open when the brand voice save is refused', async () => {
  const phrase = `phrase ${randomUUID().replaceAll('-', '')}`
  const row = await suggest('banned_word', { phrase })
  voiceSave.refuse = 'An active brand voice must stay complete.'

  const result = await acceptSuggestionAction(row.id)

  expect(result).toEqual({ ok: false, error: 'An active brand voice must stay complete.' })
  const after = await payload.findByID({
    collection: 'setup-suggestions',
    id: row.id,
    depth: 0,
    overrideAccess: true,
  })
  expect(after.status).toBe('open')
})
