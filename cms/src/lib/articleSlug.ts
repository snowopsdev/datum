import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'

/** Long enough for any honest title, short enough for a readable URL. */
export const MAX_SLUG_LENGTH = 80

/**
 * Lower case, `a-z0-9` words joined by single hyphens, no hyphen at either
 * end, at most `MAX_SLUG_LENGTH` characters. Accents fold to their base letter
 * (`café` → `cafe`); anything else outside `a-z0-9` becomes a separator. The
 * result is empty when nothing usable is left.
 */
export function normaliseSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')
}

/** `base` with `-n` appended, trimmed so the whole still fits. */
function withSuffix(base: string, n: number): string {
  const suffix = `-${n}`
  return `${base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`
}

const BATCH = 25

/**
 * The first of `base`, `base-2`, `base-3`, … that no other article holds.
 * A purely numeric slug starts at `-2`: `/articles/<n>` is also the id
 * fallback route, and a slug that reads as an id would shadow one.
 */
async function firstFreeSlug(
  req: PayloadRequest,
  base: string,
  ownId: number | string | undefined,
): Promise<string> {
  const numeric = /^\d+$/.test(base)
  for (let start = numeric ? 2 : 1; ; start += BATCH) {
    const candidates = Array.from({ length: BATCH }, (_, i) =>
      start + i === 1 ? base : withSuffix(base, start + i),
    )
    const { docs } = await req.payload.find({
      collection: 'articles',
      where: {
        and: [
          { slug: { in: candidates } },
          ...(ownId != null ? [{ id: { not_equals: ownId } }] : []),
        ],
      },
      select: { slug: true },
      pagination: false,
      limit: 0,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const taken = new Set(docs.map((doc) => doc.slug))
    const free = candidates.find((candidate) => !taken.has(candidate))
    if (free) return free
  }
}

/**
 * Normalise a slug that is being set or changed, and suffix it when another
 * article already has it.
 *
 * Slugs come from the model, which happily gives two articles the same one;
 * the public route resolves a slug to one published article, so the other
 * would be unreachable and its canonical would point at its twin. An unchanged
 * slug is left alone, so an unrelated save never renames a live URL. Archived
 * articles still count as taken: the column is unique across every row.
 *
 * Two concurrent writes can still pick the same free slug; the unique index
 * turns that into an error rather than a silent duplicate.
 */
export const uniqueArticleSlug: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data || typeof data.slug !== 'string') return data
  if (originalDoc && data.slug === originalDoc.slug) return data
  const base = normaliseSlug(data.slug)
  data.slug = base ? await firstFreeSlug(req, base, originalDoc?.id) : null
  return data
}
