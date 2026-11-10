import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { MAX_SLUG_LENGTH, normaliseSlug } from '@/lib/articleSlug'
import * as slugMigration from '@/migrations/20261110_055225_article_slug_unique'

let payload: Payload
const created: number[] = []

type Executor = { execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> }
const db = () => (payload.db as unknown as { drizzle: Executor }).drizzle

async function article(slug?: string | null) {
  const doc = await payload.create({
    collection: 'articles',
    data: { keyword: `slug ${randomUUID()}`, status: 'topic_selected', slug },
    depth: 0,
  })
  created.push(doc.id)
  return doc
}

/** A token no other row's slug can contain, so each case owns its slugs. */
const token = () => randomUUID().slice(0, 8)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  // Articles cannot be deleted; archiving takes them out of every listing.
  for (const id of created) {
    await payload.update({
      collection: 'articles',
      id,
      data: { archived: true },
      overrideAccess: true,
    })
  }
})

describe('normaliseSlug', () => {
  it('lower-cases, folds accents and joins words with single hyphens', () => {
    expect(normaliseSlug('  Café Tips: The 2026 Guide!! ')).toBe('cafe-tips-the-2026-guide')
    expect(normaliseSlug('a--b__c  d')).toBe('a-b-c-d')
    expect(normaliseSlug('---')).toBe('')
  })

  it('caps the length without leaving a trailing hyphen', () => {
    const long = `${'a'.repeat(MAX_SLUG_LENGTH - 1)} bcd`
    const slug = normaliseSlug(long)
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('article slugs', () => {
  it('normalises a slug on create', async () => {
    const t = token()
    const doc = await article(`  How To ${t.toUpperCase()} Brew! `)
    expect(doc.slug).toBe(`how-to-${t}-brew`)
  })

  it('suffixes a slug another article already has', async () => {
    const base = `same-${token()}`
    const first = await article(base)
    const second = await article(base)
    const third = await article(base.toUpperCase())
    expect(first.slug).toBe(base)
    expect(second.slug).toBe(`${base}-2`)
    expect(third.slug).toBe(`${base}-3`)
  })

  it('suffixes on update, and leaves an unchanged slug alone', async () => {
    const base = `taken-${token()}`
    const owner = await article(base)
    const other = await article(`other-${token()}`)

    const moved = await payload.update({
      collection: 'articles',
      id: other.id,
      data: { slug: base },
      depth: 0,
    })
    expect(moved.slug).toBe(`${base}-2`)

    // Re-saving the owner with its own slug must not suffix it against itself.
    const resaved = await payload.update({
      collection: 'articles',
      id: owner.id,
      data: { slug: base, title: 'Retitled' },
      depth: 0,
    })
    expect(resaved.slug).toBe(base)

    // Regenerating `other` with the same model slug lands on the slug it holds.
    const regenerated = await payload.update({
      collection: 'articles',
      id: other.id,
      data: { slug: `${base.toUpperCase()} ` },
      depth: 0,
    })
    expect(regenerated.slug).toBe(`${base}-2`)
  })

  it('suffixes a purely numeric slug so it cannot shadow the id route', async () => {
    const digits = String(Date.now()).slice(-9)
    const first = await article(digits)
    const second = await article(digits)
    expect(first.slug).toBe(`${digits}-2`)
    expect(second.slug).toBe(`${digits}-3`)
  })

  it('stores no slug when nothing usable is left', async () => {
    expect((await article('!!!')).slug ?? null).toBeNull()
    expect((await article('')).slug ?? null).toBeNull()
  })

  it('rejects a duplicate that bypasses the hook', async () => {
    const base = `raw-${token()}`
    const first = await article(base)
    const second = await article(`raw-other-${token()}`)
    await expect(
      db().execute(sql`UPDATE articles SET slug = ${first.slug} WHERE id = ${second.id}`),
    ).rejects.toThrow()
  })
})

describe('article_slug_unique migration', () => {
  it('renames later duplicates to -<id>, nulls empty slugs, then enforces uniqueness', async () => {
    const shared = `legacy-${token()}`
    const a = await article(`seed-a-${token()}`)
    const b = await article(`seed-b-${token()}`)
    const c = await article(`seed-c-${token()}`)
    const empty = await article(`seed-e-${token()}`)
    const args = { db: db(), payload, req: {} } as never

    // Back to the old schema, and the data it allowed.
    await slugMigration.down(args)
    try {
      await db().execute(
        sql`UPDATE articles SET slug = ${shared} WHERE id IN (${a.id}, ${b.id}, ${c.id})`,
      )
      await db().execute(sql`UPDATE articles SET slug = '' WHERE id = ${empty.id}`)
    } finally {
      await slugMigration.up(args)
    }

    const { rows } = await db().execute(
      sql`SELECT id, slug FROM articles WHERE id IN (${a.id}, ${b.id}, ${c.id}, ${empty.id}) ORDER BY id`,
    )
    const slugs = Object.fromEntries(rows.map((row) => [row.id, row.slug]))
    expect(slugs[a.id]).toBe(shared)
    expect(slugs[b.id]).toBe(`${shared}-${b.id}`)
    expect(slugs[c.id]).toBe(`${shared}-${c.id}`)
    expect(slugs[empty.id]).toBeNull()

    const { rows: index } = await db().execute(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'articles_slug_idx'`,
    )
    expect(String(index[0]?.indexdef)).toContain('UNIQUE')
  })
})
