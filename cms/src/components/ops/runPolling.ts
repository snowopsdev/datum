/**
 * One request at a time; hidden tabs resume with a fresh read.
 *
 * A `wake` event (a run was just queued) polls immediately and holds a fast
 * cadence for `burstMs`, because the idle delay is longer than the time a
 * short run takes to start and finish.
 */
export function startRunPolling({
  poll,
  visibility,
  wake,
  wakeType = 'datum:run-queued',
  activeDelay = 3000,
  idleDelay = 15000,
  burstDelay = 1000,
  burstMs = 10000,
}: {
  poll: () => Promise<boolean>
  visibility: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>
  wake?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
  wakeType?: string
  activeDelay?: number
  idleDelay?: number
  burstDelay?: number
  burstMs?: number
}): () => void {
  let stopped = false
  let pending = false
  let active = false
  let rewake = false
  let burstUntil = 0
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
      // A wake during a request: that read may predate the action, so go again.
      const delay = active ? activeDelay : idleDelay
      if (rewake) {
        rewake = false
        schedule(0)
      } else schedule(Date.now() < burstUntil ? Math.min(delay, burstDelay) : delay)
    }
  }
  const onWake = () => {
    if (stopped || visibility.hidden) return
    burstUntil = Date.now() + burstMs
    if (pending) rewake = true
    else schedule(0)
  }
  const onVisibility = () => {
    clearTimeout(timer)
    if (!visibility.hidden) schedule(0)
  }
  visibility.addEventListener('visibilitychange', onVisibility)
  wake?.addEventListener(wakeType, onWake)
  schedule(0)
  return () => {
    stopped = true
    clearTimeout(timer)
    visibility.removeEventListener('visibilitychange', onVisibility)
    wake?.removeEventListener(wakeType, onWake)
  }
}
