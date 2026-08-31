import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { createAhrefsClient } from '../src/ahrefs'
import { config } from '../src/config'

const originalKey = config.ahrefsApiKey

describe('createAhrefsClient', () => {
  afterEach(() => {
    config.ahrefsApiKey = originalKey
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
})
