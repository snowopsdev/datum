import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isBlockedAddress, isBlockedHostname, normaliseHostname } from '../src/corpus/addressGuard'

describe('isBlockedAddress (IPv4)', () => {
  const blocked = [
    '0.0.0.0',
    '0.1.2.3',
    '127.0.0.1',
    '127.1.1.1',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.20.10.5',
    '172.31.255.254',
    '192.168.0.1',
    '192.168.1.100',
    '169.254.169.254',
    '169.254.0.1',
    '100.64.0.1',
    '100.127.255.255',
    '192.0.0.1',
    '198.18.0.1',
    '198.19.255.255',
    '224.0.0.1',
    '239.255.255.250',
    '255.255.255.255',
  ]
  for (const ip of blocked) {
    it(`blocks ${ip}`, () => {
      assert.equal(isBlockedAddress(ip), true)
    })
  }

  const allowed = [
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '172.15.255.255',
    '172.32.0.1',
    '192.167.255.255',
    '192.169.0.1',
    '169.253.0.1',
    '169.255.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '11.0.0.1',
    '126.255.255.255',
    '128.0.0.1',
    '223.255.255.255',
  ]
  for (const ip of allowed) {
    it(`allows ${ip}`, () => {
      assert.equal(isBlockedAddress(ip), false)
    })
  }
})

describe('isBlockedAddress (IPv6)', () => {
  const blocked = [
    '::',
    '::1',
    '0:0:0:0:0:0:0:1',
    'fc00::',
    'fd12:3456:789a::1',
    'fdff:ffff::ffff',
    'fe80::1',
    'fe80::1%eth0',
    'febf::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:10.0.0.1',
    '::ffff:7f00:1',
    '::ffff:c0a8:1',
    '64:ff9b::1',
  ]
  for (const ip of blocked) {
    it(`blocks ${ip}`, () => {
      assert.equal(isBlockedAddress(ip), true)
    })
  }

  const allowed = [
    '2001:4860:4860::8888',
    '2001:4860::',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
    'fbff::1',
    'fec0::1',
    '2a00:1450:4009:81f::200e',
  ]
  for (const ip of allowed) {
    it(`allows ${ip}`, () => {
      assert.equal(isBlockedAddress(ip), false)
    })
  }
})

describe('isBlockedAddress (fail closed)', () => {
  for (const value of ['', '   ', 'not an ip', '1.2.3', '1.2.3.4.5', '256.1.1.1', 'gggg::1']) {
    it(`blocks unparseable input ${JSON.stringify(value)}`, () => {
      assert.equal(isBlockedAddress(value), true)
    })
  }

  it('tolerates surrounding whitespace on a real address', () => {
    assert.equal(isBlockedAddress('  8.8.8.8 '), false)
    assert.equal(isBlockedAddress('  127.0.0.1 '), true)
  })
})

describe('normaliseHostname', () => {
  it('lower-cases, strips IPv6 brackets, and drops the root dot', () => {
    assert.equal(normaliseHostname('Example.COM.'), 'example.com')
    assert.equal(normaliseHostname('[::1]'), '::1')
    assert.equal(normaliseHostname('  EXAMPLE.com  '), 'example.com')
  })
})

describe('isBlockedHostname', () => {
  const blocked = [
    'localhost',
    'LOCALHOST',
    'app.localhost',
    'printer.local',
    'metadata.internal',
    'wiki.intranet',
    'router.home.arpa',
    'buildbox',
    '',
    '127.0.0.1',
    '[::1]',
    '169.254.169.254',
  ]
  for (const host of blocked) {
    it(`blocks ${JSON.stringify(host)}`, () => {
      assert.equal(isBlockedHostname(host), true)
    })
  }

  const allowed = ['example.com', 'competitor-one.com', 'sub.industry-mag.example.com', '8.8.8.8']
  for (const host of allowed) {
    it(`allows ${host}`, () => {
      assert.equal(isBlockedHostname(host), false)
    })
  }
})
