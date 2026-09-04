/** One request at a time; hidden tabs resume with a fresh read. */
export function startRunPolling({
  poll,
  visibility,
  activeDelay = 3000,
  idleDelay = 15000,
}: {
  poll: () => Promise<boolean>
  visibility: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>
  activeDelay?: number
  idleDelay?: number
}): () => void {
  let stopped = false
  let pending = false
  let active = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = (delay: number) => {
    clearTimeout(timer)
    if (!stopped && !visibility.hidden) timer = setTimeout(() => void tick(), delay)
  }
  const tick = async () => {
    if (stopped || pending || visibility.hidden) return
    pending = true
    try {
      active = await poll()
    } catch {
      /* Keep the last successful state and cadence. */
    } finally {
      pending = false
      schedule(active ? activeDelay : idleDelay)
    }
  }
  const onVisibility = () => {
    clearTimeout(timer)
    if (!visibility.hidden) schedule(0)
  }
  visibility.addEventListener('visibilitychange', onVisibility)
  schedule(0)
  return () => {
    stopped = true
    clearTimeout(timer)
    visibility.removeEventListener('visibilitychange', onVisibility)
  }
}
