import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { Media } from '@/collections/Media'

let payload: Payload

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>',
)
const HTML = Buffer.from('<script>alert(1)</script>')

const upload = (name: string, mimetype: string, data: Buffer) =>
  payload.create({
    collection: 'media',
    data: { alt: 'upload test' },
    file: { data, mimetype, name, size: data.length },
  })

describe('media uploads', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('allows raster images only', () => {
    expect(Media.upload).toMatchObject({
      mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
    })
  })

  it('accepts a PNG upload', async () => {
    const doc = await upload('media-upload-test.png', 'image/png', PNG)
    try {
      expect(doc.mimeType).toBe('image/png')
    } finally {
      await payload.delete({ collection: 'media', id: doc.id })
    }
  })

  it('refuses a script-free SVG upload (an SVG is served from the app origin)', async () => {
    await expect(upload('media-upload-test.svg', 'image/svg+xml', SVG)).rejects.toThrow()
  })

  it('refuses an HTML upload', async () => {
    await expect(upload('media-upload-test.html', 'text/html', HTML)).rejects.toThrow()
  })
})
