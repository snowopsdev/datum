import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { createAhrefsClient } from '../src/ahrefs'
import { config } from '../src/config'
import { resolveWorkspaceProfile } from '../src/tenant'

const originalKey = config.ahrefsApiKey
const originalTargetDomain = process.env.TARGET_DOMAIN
const originalCompetitors = process.env.COMPETITOR_DOMAINS

/** Reaches the private field the factory injected, which is the point of the test. */
const injected = (client: unknown, field: string): unknown =>
  (client as unknown as Record<string, unknown>)[field]

describe('createAhrefsClient', () => {
  afterEach(() => {
    config.ahrefsApiKey = originalKey
    process.env.TARGET_DOMAIN = originalTargetDomain
    process.env.COMPETITOR_DOMAINS = originalCompetitors
  })

  it('mock mode wins even when a key is present', () => {
    config.ahrefsApiKey = 'key-present'
    assert.equal(createAhrefsClient('mock').constructor.name, 'MockAhrefsClient')
  })

  it('live mode with a key uses the real client', () => {
    config.ahrefsApiKey = 'key-present'
    assert.equal(createAhrefsClient('live').constructor.name, 'RealAhrefsClient')
  })

  it('live mode without a key degrades to mock', () => {
    config.ahrefsApiKey = undefined
    assert.equal(createAhrefsClient('live').constructor.name, 'MockAhrefsClient')
  })

  it('works for the workspace it is handed, not the ambient environment', () => {
    config.ahrefsApiKey = 'key-present'
    process.env.TARGET_DOMAIN = 'env.example'
    process.env.COMPETITOR_DOMAINS = 'envrival.example'
    const profile = resolveWorkspaceProfile(
      {
        targetDomain: 'acme.example',
        competitors: [{ domain: 'rivalone.com', name: 'Rival One' }],
      },
      process.env,
    )

    const client = createAhrefsClient('live', profile)

    assert.equal(injected(client, 'targetDomain'), 'acme.example')
    assert.deepEqual(injected(client, 'competitorDomains'), ['rivalone.com'])
  })

  it('falls back to the environment when no profile is passed', () => {
    config.ahrefsApiKey = 'key-present'
    process.env.TARGET_DOMAIN = 'env.example'
    process.env.COMPETITOR_DOMAINS = 'envrival.example,other.example'

    const client = createAhrefsClient('live')

    assert.equal(injected(client, 'targetDomain'), 'env.example')
    assert.deepEqual(injected(client, 'competitorDomains'), ['envrival.example', 'other.example'])
  })

  it('refuses to report content gaps in live mode with no target domain', async () => {
    config.ahrefsApiKey = 'key-present'
    delete process.env.TARGET_DOMAIN
    delete process.env.COMPETITOR_DOMAINS

    const client = createAhrefsClient('live')

    assert.equal(injected(client, 'targetDomain'), null)
    // Every competitor keyword would look like a gap, so it says so instead of
    // issuing the request.
    await assert.rejects(() => client.contentGapKeywords(), /target domain is required/i)
  })
})
