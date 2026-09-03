import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { EvidenceBank } from '@/globals/EvidenceBank'
import { loadWorkspaceSetup } from '@/lib/loadWorkspaceReadiness'
import { evidenceBankContentOf, isEvidenceBankEmpty } from '@/lib/tenant'
import { evidenceBankFixtureDoc } from '@/lib/tenant/fixtures'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { LlmClient } from '../../../pipeline/src/llm'
import { markdownToLexical } from '../../../pipeline/src/richtext'
import { buildPrompt } from '../../../pipeline/src/generatePrompt'
import { stages, type StageContext } from '../../../pipeline/src/stages'
import { loadStyleGuide } from '../../../pipeline/src/styleGuide'
import { loadTenantContext } from '../../../pipeline/src/tenant'

let payload: Payload

/**
 * Every field the global owns, blanked — `refCounter` deliberately excluded.
 *
 * Emptying the bank is not the same as forgetting which refs have been spent:
 * a published article's `evidenceCitations` may still point at `E4`, and a
 * counter reset would hand that number to a different claim.
 */
const EMPTY_GLOBAL = {
  verifiedClaims: [],
  facts: [],
  rejectedClaims: [],
  notes: null,
}

const readGlobal = () =>
  payload.findGlobal({ slug: 'evidence-bank', depth: 0, overrideAccess: true })

const clear = () =>
  payload.updateGlobal({ slug: 'evidence-bank', data: EMPTY_GLOBAL, overrideAccess: true })

const write = (data: Record<string, unknown>) =>
  payload.updateGlobal({ slug: 'evidence-bank', data, overrideAccess: true })

const refsOf = async () => {
  const doc = (await readGlobal()) as unknown as Record<string, unknown>
  const rows = (field: string) =>
    (Array.isArray(doc[field]) ? (doc[field] as { ref?: string }[]) : []).map((row) => row.ref)
  return {
    claims: rows('verifiedClaims'),
    facts: rows('facts'),
    rejected: rows('rejectedClaims'),
    counter: Number(doc.refCounter ?? 0),
  }
}

/**
 * Empty the bank and report the counter that survived.
 *
 * Clearing every row does not reset `refCounter`, and must not: a published
 * article's `evidenceCitations` may still point at `E4`, so the number stays
 * spent whether or not the row is still there. Every assertion below is
 * therefore relative to the counter this returns rather than to `E1`.
 */
const startFresh = async (): Promise<number> => {
  await clear()
  return (await refsOf()).counter
}

const auditRowsSince = async (createdAfter: string) => {
  const { docs } = await payload.find({
    collection: 'governance-audit',
    where: {
      and: [
        { subjectGlobal: { equals: 'evidence-bank' } },
        { createdAt: { greater_than_equal: createdAfter } },
      ],
    },
    sort: '-createdAt',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return docs
}

describe('evidence bank global', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await clear()
  })

  afterAll(async () => {
    await clear()
  })

  it('is readable and writable only when signed in', async () => {
    for (const operation of ['read', 'update'] as const) {
      expect(await EvidenceBank.access?.[operation]?.({ req: { user: null } } as never)).toBe(false)
      expect(await EvidenceBank.access?.[operation]?.({ req: { user: { id: 1 } } } as never)).toBe(
        true,
      )
    }
  })

  it('states the operating rules in the field descriptions', () => {
    const description = (name: string) => {
      const field = EvidenceBank.fields.find((f) => 'name' in f && f.name === name)
      const admin = field && 'admin' in field ? (field.admin as { description?: string }) : undefined
      return admin?.description ?? ''
    }
    // Proof travels with the claim.
    expect(description('verifiedClaims')).toContain('limits')
    // A softened version of an unsupported claim is still unsupported: the
    // limits field is what QA fails a draft against.
    expect(EvidenceBank.admin?.description).toContain('softened version')
    // Rejected claims stay visible so they do not come back.
    expect(description('rejectedClaims')).toContain('rather than deleting them')
  })

  it('assigns a ref to every new row and leaves existing ones alone', async () => {
    const base = await startFresh()
    await write({
      verifiedClaims: [{ claim: 'First claim' }, { claim: 'Second claim' }],
      facts: [{ fact: 'Founded in 2021' }],
      rejectedClaims: [{ claim: 'The fastest', status: 'rejected' }],
    })

    const first = await refsOf()
    // One counter for all three prefixes: refs only have to be unique and
    // stable, and `E1` never coexisting with `F1` costs nothing.
    expect(first.claims).toEqual([`E${base + 1}`, `E${base + 2}`])
    expect(first.facts).toEqual([`F${base + 3}`])
    expect(first.rejected).toEqual([`R${base + 4}`])
    expect(first.counter).toBe(base + 4)

    // A save that changes nothing must not mint a ref.
    await write({ notes: 'a note' })
    expect((await refsOf()).counter).toBe(base + 4)
  })

  it('never reuses a ref after a row is deleted', async () => {
    const base = await startFresh()
    const [one, two, three] = [base + 1, base + 2, base + 3].map((n) => `E${n}`)
    await write({ verifiedClaims: [{ claim: 'One' }, { claim: 'Two' }, { claim: 'Three' }] })
    expect((await refsOf()).claims).toEqual([one, two, three])

    // Delete the middle row, keeping the others with their refs.
    const doc = (await readGlobal()) as { verifiedClaims: { ref: string; claim: string }[] }
    await write({
      verifiedClaims: doc.verifiedClaims
        .filter((row) => row.ref !== two)
        .map((row) => ({ ref: row.ref, claim: row.claim })),
    })
    expect((await refsOf()).claims).toEqual([one, three])

    // The next row gets the next number, not the freed one: a published article
    // citing the old ref must never silently start pointing at another claim.
    const kept = (await readGlobal()) as { verifiedClaims: { ref: string; claim: string }[] }
    await write({
      verifiedClaims: [
        ...kept.verifiedClaims.map((row) => ({ ref: row.ref, claim: row.claim })),
        { claim: 'Four' },
      ],
    })
    const after = await refsOf()
    expect(after.claims).toEqual([one, three, `E${base + 4}`])
    expect(after.counter).toBe(base + 4)
  })

  it('keeps the counter after every row is deleted', async () => {
    const base = await startFresh()
    await write({ facts: [{ fact: 'A fact' }] })
    expect((await refsOf()).counter).toBe(base + 1)
    // Emptying the bank is not forgetting which refs have been spent.
    await clear()
    const emptied = await refsOf()
    expect(emptied.facts).toEqual([])
    expect(emptied.counter).toBe(base + 1)
  })

  it('keeps the counter monotonic across a partial update that omits it', async () => {
    const base = await startFresh()
    await write({ facts: [{ fact: 'One fact' }] })
    expect((await refsOf()).facts).toEqual([`F${base + 1}`])
    // Only `verifiedClaims` in this payload: the hook has to find the counter
    // on the saved document rather than in `data`, which is how the demo
    // fixture and any script writes.
    await write({ verifiedClaims: [{ claim: 'A claim' }] })
    const after = await refsOf()
    expect(after.claims).toEqual([`E${base + 2}`])
    expect(after.counter).toBe(base + 2)
  })

  it('writes an audit row carrying the before and after of every changed field', async () => {
    await startFresh()
    const startedAt = new Date().toISOString()
    await write({ notes: 'first note' })
    await write({ notes: 'second note' })

    const rows = await auditRowsSince(startedAt)
    expect(rows.length).toBeGreaterThanOrEqual(2)
    const latest = rows[0]!
    expect(latest.subjectGlobal).toBe('evidence-bank')
    expect(latest.event).toBe('evidence_bank_updated')
    const details = latest.details as {
      changedFields: string[]
      before: Record<string, unknown>
      after: Record<string, unknown>
    }
    expect(details.changedFields).toContain('notes')
    expect(details.before.notes).toBe('first note')
    expect(details.after.notes).toBe('second note')
  })

  it('reaches a run as null until something is saved, and as content after', async () => {
    await startFresh()
    const empty = await loadTenantContext(payload, { mode: 'mock', asOf: '2026-09-02' })
    expect(empty.evidenceBank).toBeNull()

    await write(evidenceBankFixtureDoc())
    const filled = await loadTenantContext(payload, { mode: 'mock', asOf: '2026-09-02' })
    expect(filled.evidenceBank?.verifiedClaims).toHaveLength(3)
    // And it reaches the writer: the loader and the renderer are only useful
    // composed, and nothing else in the suite runs the two together against a
    // real database.
    const prompt = buildPrompt(
      { id: 1, keyword: 'governed content', research: {} } as never,
      { id: 1, name: 'How-To', seoSpec: {} } as never,
      null,
      filled,
    )
    expect(prompt).toContain('# Evidence rules')
    expect(prompt).toContain('# Evidence bank')
    expect(prompt).toContain('## Never state these')
    expect(prompt).toContain('[E1]')
    expect(prompt).not.toContain('Datum has none')
    expect(filled.evidenceBank?.verifiedClaims[0]?.ref).toBe('E1')
    // Dates survive the timestamp column as plain days, which is what every
    // expiry comparison is made against.
    expect(filled.evidenceBank?.verifiedClaims[0]?.recheckAt).toBe('2027-06-30')
    expect(filled.evidenceBank?.verifiedClaims[0]?.clearedSurfaces).toEqual(['web', 'blog'])
    expect(filled.evidenceBank?.rejectedClaims[0]?.replacement).toBe('E1')
    // The operator's notes are stored but never reach the prompt renderer's
    // input type, so they cannot leak into a draft.
    expect(filled.evidenceBank).not.toHaveProperty('notes')
  })

  it('is a recommendation in readiness, never a blocker', async () => {
    await startFresh()
    const missing = await loadWorkspaceSetup(payload)
    expect(missing.readiness.tenant.evidenceBank.status).toBe('missing')
    expect(missing.readiness.tenant.recommendations).toContain('Add an evidence bank')
    expect(missing.readiness.governance.problems).not.toContain('Add an evidence bank')

    await write(evidenceBankFixtureDoc())
    const ready = await loadWorkspaceSetup(payload)
    expect(ready.readiness.tenant.evidenceBank.status).toBe('ready')
    expect(ready.readiness.tenant.evidenceBank.usable).toBe(3)
    expect(ready.readiness.tenant.evidenceBank.facts).toBe(2)
    expect(ready.readiness.tenant.recommendations).not.toContain('Add an evidence bank')
    // Saving it moves the fingerprint, so a verification run done before the
    // bank existed is correctly reported as stale.
    expect(ready.readiness.configFingerprint).not.toBe(missing.readiness.configFingerprint)
  })

  it('reads an unsaved global as an empty bank rather than throwing', async () => {
    await startFresh()
    const content = evidenceBankContentOf(await readGlobal())
    expect(isEvidenceBankEmpty(content)).toBe(true)
  })

  /**
   * The failing path end to end, against a real database.
   *
   * The mock fixture deliberately finds nothing — the mock corpus is about
   * espresso and the demo tenant is a content pipeline, so no mock draft makes
   * a first-party claim, and a fixture that always failed would end every mock
   * run in `needs_revision`. The failure is exercised with an injected client
   * instead, which is also the only way to prove the verdict survives the JSON
   * columns it is stored in.
   */
  it('sends an article back for a rejected claim, with the verdict stored on it', async () => {
    await startFresh()
    await write(evidenceBankFixtureDoc())

    const template = await payload.create({
      collection: 'templates',
      overrideAccess: true,
      data: {
        name: `Evidence check ${randomUUID()}`,
        outline: markdownToLexical('## Steps') as never,
        requiredSections: [{ heading: 'Steps' }, { heading: 'FAQ' }],
        seoSpec: {
          titleTagMaxLength: 60,
          metaDescriptionMaxLength: 160,
          faqRequired: true,
          faqMinQuestions: 1,
          faqMaxQuestions: 4,
          ogTagsRequired: false,
        },
      } as never,
    })
    const article = await payload.create({
      collection: 'articles',
      overrideAccess: true,
      data: {
        keyword: `evidence check ${randomUUID()}`,
        status: 'drafted',
        title: 'How the reviewer gate works',
        titleTag: 'The reviewer gate',
        metaDescription: 'A short guide.',
        template: template.id,
        faqItems: [{ question: 'Does a person read it?', answer: 'Yes.' }],
        body: markdownToLexical(
          '## Steps\nDatum guarantees your articles will rank.\n## FAQ\nDoes a person read it? Yes.',
        ) as never,
        evidenceCitations: [{ ref: 'E1', excerpt: 'A reviewer approves the brief.' }],
      } as never,
    })

    const llm: LlmClient = {
      async completeJSON(stage) {
        const json =
          stage === 'evidenceCheck'
            ? {
                claims: [
                  {
                    excerpt: 'Datum guarantees your articles will rank.',
                    kind: 'first_party',
                    status: 'rejected',
                    ref: 'R6',
                    note: 'Paraphrases a rejected claim.',
                  },
                ],
                notes: 'One rejected claim.',
              }
            : { passed: true, notes: 'fine', sources: [] }
        return {
          json,
          provider: 'mock',
          model: 'mock-evidence',
          usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
        }
      },
    }

    const qaStage = stages.find((stage) => stage.name === 'qa')!
    const ctx = {
      payload,
      runId: `evidence-${randomUUID()}`,
      mode: 'mock',
      ahrefs: {},
      styleGuide: loadStyleGuide(),
      models: {},
      brandVoice: null,
      policy: {},
      evidenceSources: [],
      tenant: await loadTenantContext(payload, { mode: 'mock', asOf: '2026-09-02' }),
      llm,
    } as unknown as StageContext

    const outcome = await qaStage.run(
      (await payload.findByID({ collection: 'articles', id: article.id, overrideAccess: true })) as never,
      ctx,
    )
    expect(outcome.status).toBe('needs_revision')

    // Written back exactly as `runPipeline` writes it, so the JSON columns and
    // the field group are exercised rather than assumed.
    await payload.update({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
      data: { ...outcome.data, status: outcome.status } as never,
      context: {
        articleAudit: { actor: 'pipeline', actorType: 'pipeline', event: 'qa_completed', stage: 'qa' },
      },
    })

    const stored = await payload.findByID({
      collection: 'articles',
      id: article.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.status).toBe('needs_revision')
    expect(stored.qaResults?.evidenceCheck?.passed).toBe(false)
    expect(String(stored.qaResults?.evidenceCheck?.notes)).toContain(
      'Remove or replace: Datum guarantees your articles will rank. (rejected, use E1)',
    )
    const claims = stored.qaResults?.evidenceCheck?.claims as { status: string; ref: string }[]
    expect(claims).toHaveLength(1)
    expect(claims[0].status).toBe('rejected')
    expect(claims[0].ref).toBe('R6')
    expect((stored.qaModels as Record<string, string>).evidenceCheck).toBe('mock-evidence')
    // And a cost row for the new stage, so the run bar and the reports can see it.
    const costs = await payload.find({
      collection: 'cost-log',
      where: { and: [{ article: { equals: article.id } }, { stage: { equals: 'evidenceCheck' } }] },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    expect(costs.docs).toHaveLength(1)
  })
})
