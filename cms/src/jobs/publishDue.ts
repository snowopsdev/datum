import type { TaskConfig } from 'payload'

type PublishDueTask = {
  input: object
  output: { published: number[] }
}

/**
 * Publishes approved articles whose `publishAt` has arrived. The queue, not an
 * admin edit, performs the transition — the same convention as the content
 * pipeline — so gates, the audit row, the status webhook, and the cache purge
 * (via the revalidate consumer) all fire exactly as they do for a manual
 * publish.
 *
 * Selection is purely by current state (`approved` + due + not archived), so
 * re-running converges: a crash mid-batch republishes nothing, and an article
 * someone moved off `approved` keeps its `publishAt` as inert intent.
 *
 * Deliberately not on the `content` queue: `ContentRunTask` holds a
 * concurrency lock for whole pipeline runs, and publish latency must not wait
 * on one.
 */
export const PublishDueTask: TaskConfig<PublishDueTask> = {
  slug: 'publish-due',
  label: 'Publish due articles',
  retries: 0,
  schedule: [{ cron: '0 */5 * * * *', queue: 'scheduled' }],
  inputSchema: [],
  outputSchema: [{ name: 'published', type: 'json', required: true }],
  async handler({ req }) {
    const { docs } = await req.payload.find({
      collection: 'articles',
      where: {
        and: [
          { status: { equals: 'approved' } },
          { publishAt: { less_than_equal: new Date().toISOString() } },
          { archived: { not_equals: true } },
        ],
      },
      pagination: false,
      depth: 0,
      sort: 'publishAt',
      overrideAccess: true,
    })
    const published: number[] = []
    for (const article of docs) {
      // One article's failure must not hold back the rest of the batch; it
      // stays `approved` and the next run retries it.
      try {
        // The eligibility conditions are repeated in the update's own `where`
        // rather than trusting the batch query above: a reviewer can move the
        // article off `approved` (or archive it) while the batch iterates, and
        // an unconditional write by id would publish it anyway, undoing them.
        const result = await req.payload.update({
          collection: 'articles',
          where: {
            and: [
              { id: { equals: article.id } },
              { status: { equals: 'approved' } },
              { publishAt: { less_than_equal: new Date().toISOString() } },
              { archived: { not_equals: true } },
            ],
          },
          data: { status: 'published', publishedAt: new Date().toISOString() },
          context: {
            articleAudit: {
              actor: 'scheduler',
              actorType: 'system',
              event: 'scheduled_publish',
              summary: 'Published on schedule',
              details: { publishAt: article.publishAt },
            },
          },
          overrideAccess: true,
        })
        if (result.errors.length > 0) {
          throw new Error(result.errors.map((e) => e.message).join('; '))
        }
        if (result.docs.length > 0) published.push(article.id)
      } catch (error) {
        req.payload.logger.error(
          `scheduled publish failed for article ${article.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }
    return { output: { published } }
  },
}
