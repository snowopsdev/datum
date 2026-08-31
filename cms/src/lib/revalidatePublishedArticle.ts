import { revalidatePath } from 'next/cache'

/**
 * Purges the reader-facing cache for one article. The public route is ISR
 * (`app/(frontend)/articles/[slug]/page.tsx`), so invalidation is per path,
 * which for that route means per article — draft churn on other articles never
 * touches it. The page also answers on `/articles/<id>` as a slug fallback, so
 * both paths purge together.
 *
 * Only callable where Next has a request context (server actions, route
 * handlers). The jobs worker publishes through the webhook consumer route
 * instead, which calls this after verifying the delivery signature.
 */
export function revalidatePublishedArticle(article: {
  id: number | string
  slug?: string | null
}): void {
  revalidatePath(`/articles/${article.id}`)
  const slug = article.slug?.trim()
  if (slug) revalidatePath(`/articles/${slug}`)
}
