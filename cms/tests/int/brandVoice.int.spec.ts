import { describe, expect, it, vi } from 'vitest'

import { BrandVoiceFiles } from '@/collections/BrandVoiceFiles'
import {
  BrandVoices,
  cascadeSingleActive,
  draftOnlyDelete,
  gateActivation,
} from '@/collections/BrandVoices'
import { GovernanceAudit } from '@/collections/GovernanceAudit'
import {
  bannedWordsOf,
  brandVoiceActivationProblems,
  brandVoiceSamplesToPrompt,
  brandVoiceSlug,
  brandVoiceToGuideMarkdown,
  brandVoiceToPrompt,
  emptyBrandVoiceContent,
  MAX_SAMPLE_CHARS,
  parseBrandVoiceContent,
  shortBannedWords,
} from '@/lib/brandVoice'
import { BRAND_VOICE_FIXTURE } from '@/lib/brandVoiceFixture'
import { auditGovernanceChange } from '@/lib/governanceAudit'

describe('brand voice content helpers', () => {
  it('normalises loose extraction output: clamps dials, truncates lists, dedupes words', () => {
    const { content, warnings } = parseBrandVoiceContent({
      name: '  Acme  ',
      tone: { formality: 9, warmth: '0', boldness: 'x', energy: 2.6 },
      voiceAdjectives: [
        { adjective: 'a' },
        { adjective: 'b' },
        { adjective: 'c' },
        { adjective: 'd' },
        { adjective: '' },
      ],
      bannedWords: [{ word: 'Synergy' }, { word: 'synergy' }, { word: ' ' }, { word: 'hype' }],
      samples: [{ text: 'x'.repeat(MAX_SAMPLE_CHARS + 50), title: 'Long' }],
      audience: { languageLevel: 'Professional' },
    })

    expect(content.name).toBe('Acme')
    expect(content.tone).toEqual({ formality: 5, warmth: 1, boldness: 3, energy: 3 })
    expect(content.voiceAdjectives.map((a) => a.adjective)).toEqual(['a', 'b', 'c'])
    expect(content.bannedWords.map((w) => w.word)).toEqual(['Synergy', 'hype'])
    expect(content.samples[0].text.length).toBeLessThanOrEqual(MAX_SAMPLE_CHARS + 1)
    expect(content.audience.languageLevel).toBe('professional')
    expect(warnings.join('\n')).toMatch(/adjectives/)
    expect(warnings.join('\n')).toMatch(/truncated/)
  })

  it('never throws on garbage input', () => {
    expect(parseBrandVoiceContent(null).content).toEqual(emptyBrandVoiceContent())
    expect(parseBrandVoiceContent('nope').content.name).toBe('')
    expect(parseBrandVoiceContent({ coreValues: 'x', tone: 4 }).content.coreValues).toEqual([])
  })

  it('reports activation problems for an empty record and none for the fixture', () => {
    expect(brandVoiceActivationProblems(BRAND_VOICE_FIXTURE)).toEqual([])
    const problems = brandVoiceActivationProblems(emptyBrandVoiceContent())
    expect(problems.join('\n')).toMatch(/name/)
    expect(problems.join('\n')).toMatch(/one-liner/)
    expect(problems.join('\n')).toMatch(/core values/)
    expect(problems.join('\n')).toMatch(/persona/)
    expect(problems.join('\n')).toMatch(/exactly 3 adjectives/)
    expect(problems.join('\n')).toMatch(/NOT/)
  })

  it('exposes lower-cased, de-duplicated banned words and flags short ones', () => {
    const bv = parseBrandVoiceContent({
      bannedWords: [
        { word: ' Just ' },
        { word: 'JUST' },
        { word: 'Synergy' },
        { word: 'so' },
        { word: '' },
      ],
    }).content
    expect(bannedWordsOf(bv)).toEqual(['just', 'synergy', 'so'])
    expect(shortBannedWords(bv)).toEqual(['so'])
  })

  it('renders a deterministic prompt block that omits empty sections', () => {
    const first = brandVoiceToPrompt(BRAND_VOICE_FIXTURE)
    expect(brandVoiceToPrompt(BRAND_VOICE_FIXTURE)).toBe(first)
    expect(first).toMatch(/^# Brand voice \(tenant\)/)
    expect(first).toContain('bodyMarkdown')
    expect(first).toContain('metaDescription')
    expect(first).toContain('## What we are NOT')
    expect(first).toContain('Never use these words')
    expect(first).toContain('synergy, world-class, disrupt, best-in-class')

    const bare = brandVoiceToPrompt(emptyBrandVoiceContent('Bare'))
    expect(bare).not.toContain('## Core values')
    expect(bare).not.toContain('## How we sound')
    expect(bare).not.toContain('Never use these words')
    expect(bare).toContain('## Tone dials')
  })

  it('renders samples as a separate few-shot block, or null when there are none', () => {
    expect(brandVoiceSamplesToPrompt(BRAND_VOICE_FIXTURE)).toMatch(/^# On-voice writing samples/)
    expect(brandVoiceSamplesToPrompt(emptyBrandVoiceContent())).toBeNull()
  })

  it('renders the human guide with every section and a voice-chart table', () => {
    const md = brandVoiceToGuideMarkdown(BRAND_VOICE_FIXTURE, {
      status: 'active',
      activatedAt: '2026-08-24T00:00:00.000Z',
      activatedBy: 'admin@datum.local',
    })
    for (const heading of [
      '## Mission',
      '## Core values',
      "## Who we're talking to",
      '## Our brand as a person',
      '## How we sound',
      '## What we are not',
      '## Tone dials',
      '## Words we use',
      '## Words we avoid',
      '## Writing samples',
    ]) {
      expect(md).toContain(heading)
    }
    expect(md).toMatch(/^# Datum demo brand voice — Brand & Voice Guide/)
    expect(md).toContain("| Adjective | What it means | Do | Don't |")
    expect(md).toContain('Status: active')
    expect(md).toContain('admin@datum.local')
    expect(brandVoiceToGuideMarkdown(emptyBrandVoiceContent())).toContain('_Not defined yet._')
  })

  it('escapes backslashes before pipes in table cells, not after', () => {
    const bv = {
      ...emptyBrandVoiceContent('Backslash co'),
      voiceAdjectives: [{ adjective: 'blunt', description: 'a\\|b', doExample: '', dontExample: '' }],
    }
    const md = brandVoiceToGuideMarkdown(bv)
    const row = md.split('\n').find((l) => l.includes('blunt'))
    // "a\|b" must become "a\\\|b" (escaped backslash, then escaped pipe) so a
    // markdown renderer doesn't read \| as an escaped literal pipe and merge cells.
    expect(row).toContain('a\\\\\\|b')
  })

  it('slugs names for export file names', () => {
    expect(brandVoiceSlug('Datum demo brand voice')).toBe('datum-demo-brand-voice')
    expect(brandVoiceSlug('   ')).toBe('brand-voice')
  })
})

describe('brand voice collection rules', () => {
  it('only lets authenticated users touch brand voices and uploaded files', async () => {
    for (const collection of [BrandVoices, BrandVoiceFiles]) {
      for (const op of ['read', 'create', 'update', 'delete'] as const) {
        const fn = collection.access?.[op]
        expect(await fn?.({ req: { user: null } } as never)).toBe(false)
        expect(await fn?.({ req: { user: { id: 1 } } } as never)).toBe(true)
      }
    }
  })

  it('blocks activation of an incomplete record with a readable reason', () => {
    expect(() =>
      gateActivation({
        data: { status: 'active' },
        originalDoc: { ...emptyBrandVoiceContent('Draft'), status: 'draft' },
        req: { user: null },
        operation: 'update',
      } as never),
    ).toThrow(/Cannot activate brand voice: .*persona/)
  })

  it('stamps who activated a complete record and leaves non-activations alone', () => {
    const data = gateActivation({
      data: { status: 'active' },
      originalDoc: { ...BRAND_VOICE_FIXTURE, status: 'draft' },
      req: { user: { id: 3, email: 'editor@example.com' } },
      operation: 'update',
    } as never) as Record<string, unknown>
    expect(data.activatedBy).toBe('editor@example.com')
    expect(typeof data.activatedAt).toBe('string')

    const untouched = gateActivation({
      data: { persona: 'x' },
      originalDoc: { ...emptyBrandVoiceContent(), status: 'draft' },
      req: { user: null },
      operation: 'update',
    } as never) as Record<string, unknown>
    expect(untouched).toEqual({ persona: 'x' })
  })

  it('re-validates partial updates to an already-active record', () => {
    const active = { ...BRAND_VOICE_FIXTURE, status: 'active', activatedBy: 'seed' }
    expect(() =>
      gateActivation({
        data: { coreValues: [] },
        originalDoc: active,
        req: { user: null },
        operation: 'update',
      } as never),
    ).toThrow(/Cannot save active brand voice: .*core values/)

    const ok = gateActivation({
      data: { persona: 'Still complete' },
      originalDoc: active,
      req: { user: null },
      operation: 'update',
    } as never) as Record<string, unknown>
    expect(ok).toEqual({ persona: 'Still complete' })
  })

  it('refuses to delete anything but a draft, whichever API the delete comes through', async () => {
    const findByID = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, name: 'Live voice', status: 'active' })
      .mockResolvedValueOnce({ id: 2, name: 'Old voice', status: 'archived' })
      .mockResolvedValueOnce({ id: 3, name: 'WIP', status: 'draft' })
    const req = { payload: { findByID } }

    await expect(draftOnlyDelete({ id: 1, req } as never)).rejects.toThrow(/Only draft .* is active/)
    await expect(draftOnlyDelete({ id: 2, req } as never)).rejects.toThrow(/is archived/)
    await expect(draftOnlyDelete({ id: 3, req } as never)).resolves.toBeUndefined()
    expect(BrandVoices.hooks?.beforeDelete?.[0]).toBe(draftOnlyDelete)
  })

  it('audits the record before the cascade can pollute the shared request context', () => {
    const after = BrandVoices.hooks?.afterChange ?? []
    expect(after).toHaveLength(2)
    expect(after[1]).toBe(cascadeSingleActive)
  })

  it('archives every other active record when one becomes active, once', async () => {
    const update = vi.fn().mockResolvedValue({ docs: [] })
    const req = { payload: { update } }

    await cascadeSingleActive({
      context: {},
      doc: { id: 7, name: 'New voice', status: 'active' },
      req,
    } as never)
    expect(update).toHaveBeenCalledTimes(1)
    const call = update.mock.calls[0][0]
    expect(call.collection).toBe('brand-voices')
    expect(call.where).toEqual({
      and: [{ status: { equals: 'active' } }, { id: { not_equals: 7 } }],
    })
    expect(call.data).toEqual({ status: 'archived' })
    expect(call.overrideAccess).toBe(true)
    expect(call.req).toBe(req)
    expect(call.context.brandVoiceCascade).toBe(true)
    expect(call.context.governanceAudit.event).toBe('brand_voice_superseded')

    await cascadeSingleActive({
      context: { brandVoiceCascade: true },
      doc: { id: 8, status: 'active' },
      req,
    } as never)
    await cascadeSingleActive({ context: {}, doc: { id: 9, status: 'draft' }, req } as never)
    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe('governance audit trail', () => {
  it('records annotated changes against a polymorphic subject', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    const hook = auditGovernanceChange('brand-voices', 'brand_voice')

    await hook({
      context: {
        governanceAudit: {
          event: 'brand_voice_activated',
          summary: 'Activated',
          details: { from: 'review' },
        },
      },
      data: { status: 'active' },
      doc: { id: 5, status: 'active' },
      operation: 'update',
      previousDoc: { id: 5, status: 'draft' },
      req: { payload: { create }, user: { id: 2, email: 'editor@example.com' } },
    } as never)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'governance-audit',
        overrideAccess: true,
        data: expect.objectContaining({
          subject: { relationTo: 'brand-voices', value: 5 },
          event: 'brand_voice_activated',
          summary: 'Activated',
          actor: 'editor@example.com',
          actorType: 'user',
          fromStatus: 'draft',
          toStatus: 'active',
          details: { from: 'review' },
        }),
      }),
    )
  })

  it('derives events and changed fields for unannotated edits', async () => {
    const create = vi.fn().mockResolvedValue({ id: 2 })
    const hook = auditGovernanceChange('brand-voices', 'brand_voice')

    await hook({
      context: {},
      data: { persona: 'x', updatedAt: 'now' },
      doc: { id: 5, status: 'draft' },
      operation: 'update',
      previousDoc: { id: 5, status: 'draft' },
      req: { payload: { create }, user: null },
    } as never)
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        event: 'brand_voice_updated',
        actor: 'system',
        actorType: 'system',
        details: { changedFields: ['persona'] },
      }),
    )

    await hook({
      context: {},
      data: { name: 'New' },
      doc: { id: 6, status: 'draft' },
      operation: 'create',
      previousDoc: undefined,
      req: { payload: { create }, user: null },
    } as never)
    expect(create.mock.calls[1][0].data).toEqual(
      expect.objectContaining({ event: 'brand_voice_created', toStatus: 'draft' }),
    )
  })

  it('is append-only and readable only when authenticated', async () => {
    expect(await GovernanceAudit.access?.read?.({ req: { user: null } } as never)).toBe(false)
    expect(await GovernanceAudit.access?.read?.({ req: { user: { id: 1 } } } as never)).toBe(true)
    expect(await GovernanceAudit.access?.create?.({} as never)).toBe(false)
    expect(await GovernanceAudit.access?.update?.({} as never)).toBe(false)
    expect(await GovernanceAudit.access?.delete?.({} as never)).toBe(false)
    expect(() => GovernanceAudit.hooks?.beforeChange?.[0]?.({ operation: 'update' } as never)).toThrow(
      'append-only',
    )
    expect(() => GovernanceAudit.hooks?.beforeDelete?.[0]?.({} as never)).toThrow('append-only')
  })
})
