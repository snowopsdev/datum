/**
 * Bounded-parallelism map. Competitor pages are fetched a handful at a time so
 * one snapshot never opens ten sockets at once, and the caller still gets its
 * results lined up with the URLs it passed in.
 */

/**
 * Runs `fn` over `items` with at most `limit` calls in flight. Results come
 * back in input order, not completion order. A limit below 1 is treated as 1.
 * The first rejection wins: the returned promise rejects with it and no further
 * items are started (calls already in flight are left to settle on their own).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  if (items.length === 0) return results
  const workers = Math.min(Math.max(1, Math.floor(limit)), items.length)

  let next = 0
  let failed = false
  const run = async (): Promise<void> => {
    while (!failed) {
      const index = next
      next += 1
      if (index >= items.length) return
      try {
        results[index] = await fn(items[index] as T, index)
      } catch (error) {
        failed = true
        throw error
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => run()))
  return results
}
