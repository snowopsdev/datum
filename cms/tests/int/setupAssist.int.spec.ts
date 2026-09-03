import config from '@/payload.config'
import { ASSIST_MOCK_WARNING } from '@/lib/tenant/assistFixtures'
import { ICP_FIXTURE, POSITIONING_FIXTURE } from '@/lib/tenant/fixtures'
import type { LlmSetting } from '@/payload-types'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const anthropicCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreate }
  },
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const authMock = vi.fn(async () => ({ user: { id: 1, email: 'setup@example.com' } }))

// The action authenticates through `getPayload`, and there is no Next request
// scope here to authenticate against. Everything else is the real instance, so
// the cost rows this writes are real rows in a real table.
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn(async (args: Parameters<typeof actual.getPayload>[0]) => {
      const real = await actual.getPayload(args)
      return new Proxy(real, {
        get(target, property) {
          if (property === 'auth') return authMock
          const value = Reflect.get(target, property)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    }),
  }
})

const { assistAction } = await import('@/components/ops/setupActions')

const LIVE_MODEL = 'claude-haiku-4-5' as const

const anthropicReply = (text: string) => ({
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 120, output_tokens: 45 },
})

let payload: Payload
let originalSettings: LlmSetting

/** Every assist cost row written since the marker, newest first. */
const assistRows = async (since: string) => {
  const { docs } = await payload.find({
    collection: 'cost-log',
    where: {
      and: [{ stage: { equals: 'setupAssist' } }, { createdAt: { greater_than_equal: since } }],
    },
    sort: '-createdAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return docs
}

const setAssistModel = (model: LlmSetting['setupAssistModel'] | null) =>
  payload.updateGlobal({
    slug: 'llm-settings',
    data: { setupAssistModel: model },
    overrideAccess: true,
  })

/** Everything the live path needs: no mock rule, and an Anthropic model id. */
const goLive = async () => {
  vi.stubEnv('MOCK_MODE', 'false')
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  await setAssistModel(LIVE_MODEL)
}

describe('assistAction', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    originalSettings = (await payload.findGlobal({
      slug: 'llm-settings',
      depth: 0,
      overrideAccess: true,
    })) as LlmSetting
  })

  afterAll(async () => {
    await setAssistModel(originalSettings.setupAssistModel ?? null)
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    vi.unstubAllEnvs()
    anthropicCreate.mockReset()
    await setAssistModel(null)
  })

  it('returns the demo section in mock mode and still records the call', async () => {
    const since = new Date().toISOString()
    vi.stubEnv('MOCK_MODE', 'true')

    const result = await assistAction({
      asset: 'icp',
      section: 'who',
      mode: 'draft',
      notes: 'we sell to marketing leads',
      current: undefined,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mock).toBe(true)
    expect(result.value).toEqual({ who: ICP_FIXTURE.who })
    expect(result.warnings).toEqual([ASSIST_MOCK_WARNING])
    expect(anthropicCreate).not.toHaveBeenCalled()

    const [row] = await assistRows(since)
    expect(row.provider).toBe('mock')
    expect(row.inputTokens).toBe(0)
    expect(row.outputTokens).toBe(0)
    expect(row.costUsd).toBe(0)
    expect(row.pipelineRunId).toMatch(/^setup-assist:/)
    expect(row.request).toMatchObject({
      asset: 'icp',
      section: 'who',
      mode: 'draft',
      notesChars: 'we sell to marketing leads'.length,
    })
    expect((row.response as { keys: string[] }).keys).toEqual(['who'])
  })

  it('drafts a positioning section from a live reply and bills it', async () => {
    const since = new Date().toISOString()
    await goLive()
    anthropicCreate.mockResolvedValue(
      anthropicReply(
        JSON.stringify({
          category: POSITIONING_FIXTURE.category,
          goal: POSITIONING_FIXTURE.goal,
          promise: POSITIONING_FIXTURE.promise,
          activePosition: POSITIONING_FIXTURE.activePosition,
          statement: POSITIONING_FIXTURE.statement,
          enemy: 'not this section',
        }),
      ),
    )

    const result = await assistAction({
      asset: 'positioning',
      section: 'core',
      mode: 'draft',
      notes: 'we are the one with the reviewer gate',
      current: undefined,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mock).toBe(false)
    expect(result.model).toBe(LIVE_MODEL)
    expect(result.value).toEqual({
      category: POSITIONING_FIXTURE.category,
      goal: POSITIONING_FIXTURE.goal,
      promise: POSITIONING_FIXTURE.promise,
      activePosition: POSITIONING_FIXTURE.activePosition,
      statement: POSITIONING_FIXTURE.statement,
    })

    // The operator's notes reach the model, and the schema names only this section.
    const [{ system, messages }] = anthropicCreate.mock.calls[0] as [
      { system: string; messages: { content: string }[] },
    ]
    expect(messages[0].content).toContain('we are the one with the reviewer gate')
    expect(system).toContain('"activePosition"')
    expect(system).not.toContain('"pillars"')

    const [row] = await assistRows(since)
    expect(row.provider).toBe('anthropic')
    expect(row.model).toBe(LIVE_MODEL)
    expect(row.inputTokens).toBe(120)
    expect(row.outputTokens).toBe(45)
    expect(row.costUsd).toBeGreaterThan(0)
    expect(row.request).toMatchObject({ asset: 'positioning', section: 'core', mode: 'draft' })
  })

  it('caps an assisted confidence and never returns an evidence ref', async () => {
    await goLive()
    anthropicCreate.mockResolvedValue(
      anthropicReply(
        JSON.stringify({
          verifiedClaims: [
            {
              claim: 'The median article costs under two dollars',
              primarySource: 'Cost-log export',
              verificationDepth: 'primary_document',
              recheckAt: '2027-01-31',
              ref: 'E9',
              sourceUrl: 'https://datum.example.com/made-up',
            },
          ],
        }),
      ),
    )

    const result = await assistAction({
      asset: 'evidence',
      section: 'verifiedClaims',
      mode: 'draft',
      notes: '',
      current: undefined,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [claim] = (result.value as { verifiedClaims: Record<string, unknown>[] }).verifiedClaims
    expect(claim).toMatchObject({ ref: '', recheckAt: '', verificationDepth: 'self_reported' })
    expect(claim.sourceUrl).toBe('')
    expect(result.warnings.join('\n')).toMatch(/Proposed claims are unverified/)
  })

  it('records the spend when the reply cannot be used, and says what went wrong', async () => {
    const since = new Date().toISOString()
    await goLive()
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I am afraid I cannot help with that.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 9 },
    })

    const result = await assistAction({
      asset: 'icp',
      section: 'pains',
      mode: 'draft',
      notes: '',
      current: undefined,
    })

    expect(result).toEqual({
      ok: false,
      error:
        'Setup assistant reply was not valid JSON: I am afraid I cannot help with that.',
    })

    const [row] = await assistRows(since)
    expect(row.provider).toBe('anthropic')
    expect(row.inputTokens).toBe(200)
    expect(row.outputTokens).toBe(9)
    expect(row.response).toEqual({ error: 'reply unusable; see server log' })
  })

  it('refuses a section it does not know without calling anything or billing', async () => {
    const since = new Date().toISOString()
    await goLive()

    const result = await assistAction({
      asset: 'icp',
      section: 'pillars',
      mode: 'draft',
      notes: '',
      current: undefined,
    })

    expect(result).toEqual({
      ok: false,
      error: '"pillars" is not a section of the icp record.',
    })
    expect(anthropicCreate).not.toHaveBeenCalled()
    expect(await assistRows(since)).toHaveLength(0)
  })
})
