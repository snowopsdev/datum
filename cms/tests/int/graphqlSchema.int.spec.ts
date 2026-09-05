import config from '@/payload.config'
import { configToSchema } from '@payloadcms/graphql'
import { createRequire } from 'node:module'
import { getPayload } from 'payload'
import { resolvePolicy } from '@/lib/informationGain'
import { describe, expect, it } from 'vitest'

// Payload loads GraphQL through Node. Use the same instance here instead of
// Vite's transformed ESM copy, whose schema instanceof checks cross realms.
const { graphql } = createRequire(import.meta.url)('graphql') as typeof import('graphql')

describe('GraphQL application schema', () => {
  it('builds the complete schema and accepts an introspection query', async () => {
    const { schema } = configToSchema(await config)
    const result = await graphql({ schema, source: '{ __typename }' })
    expect(result.errors).toBeUndefined()
    expect(result.data?.__typename).toBe('Query')
  })

  it('preserves legacy API choices and resolves the stored enum names', async () => {
    const payload = await getPayload({ config: await config })
    const previous = await payload.findGlobal({ slug: 'information-gain-policy' })
    try {
      const saved = await payload.updateGlobal({
        slug: 'information-gain-policy',
        data: {
          requireExactValueMatch: 'false',
          requireEvidenceLineage: 'true',
          blockFirstPartyMeasurements: null,
        } as never,
      })
      expect(saved.requireExactValueMatch).toBe('disabled')
      expect(saved.requireEvidenceLineage).toBe('enabled')
      expect(saved.blockFirstPartyMeasurements).toBeNull()
      const resolved = resolvePolicy(saved, {})
      expect(resolved.policy.requireExactValueMatch).toBe(false)
      expect(resolved.policy.requireEvidenceLineage).toBe(true)
      expect(resolved.sources.requireExactValueMatch).toBe('admin')
      expect(resolved.sources.blockFirstPartyMeasurements).toBe('default')
    } finally {
      await payload.updateGlobal({
        slug: 'information-gain-policy',
        data: {
          requireExactValueMatch: previous.requireExactValueMatch ?? null,
          requireEvidenceLineage: previous.requireEvidenceLineage ?? null,
          blockFirstPartyMeasurements: previous.blockFirstPartyMeasurements ?? null,
        },
      })
    }
  })
})
