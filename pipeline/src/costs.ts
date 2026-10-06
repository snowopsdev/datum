import type { Payload } from 'payload'

/** Sum article spend without loading the saved model evidence. */
export async function sumArticleCost(payload: Payload, articleId: number): Promise<number> {
  const { docs } = await payload.find({
    collection: 'cost-log',
    where: { article: { equals: articleId } },
    select: { costUsd: true },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return docs.reduce((sum, row) => sum + (row.costUsd ?? 0), 0)
}
