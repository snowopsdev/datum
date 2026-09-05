import { writeFile } from 'node:fs/promises'

const baseURL = process.argv[2]
const outputPath = process.argv[3]
if (!baseURL || !outputPath) throw new Error('usage: node load.mjs BASE_URL OUTPUT_PATH')

const ramps = [
  { concurrency: 1, operations: 10 },
  { concurrency: 2, operations: 20 },
  { concurrency: 5, operations: 40 },
  { concurrency: 10, operations: 80 },
  { concurrency: 20, operations: 100 },
]
const latencies = []
const errors = []
const rampResults = []
let peakInFlight = 0
let attemptedOperations = 0

for (const ramp of ramps) {
  let next = 0
  let inFlight = 0
  let rampAttempted = 0
  const startedAt = performance.now()
  const workers = Array.from({ length: ramp.concurrency }, async () => {
    while (true) {
      const operation = next++
      if (operation >= ramp.operations || errors.length > 0) return
      attemptedOperations += 1
      rampAttempted += 1
      inFlight += 1
      peakInFlight = Math.max(peakInFlight, inFlight)
      const requestStarted = performance.now()
      try {
        const response = await fetch(`${baseURL}/api/users/me`, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        })
        const body = await response.json()
        if (response.status !== 200 || body?.user !== null || body?.message !== 'Account') {
          errors.push({ operation, status: response.status, body })
          return
        }
        latencies.push(performance.now() - requestStarted)
      } catch (error) {
        errors.push({ operation, message: error instanceof Error ? error.message : String(error) })
        return
      } finally {
        inFlight -= 1
      }
    }
  })
  await Promise.all(workers)
  const durationMs = performance.now() - startedAt
  rampResults.push({
    concurrency: ramp.concurrency,
    configuredOperations: ramp.operations,
    attemptedOperations: rampAttempted,
    completed: latencies.length - rampResults.reduce((sum, row) => sum + row.completed, 0),
    durationMs,
  })
  if (errors.length > 0) break
}

const sorted = [...latencies].sort((a, b) => a - b)
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? null
const totalDurationMs = rampResults.reduce((sum, row) => sum + row.durationMs, 0)
const recoveryStarted = performance.now()
const recoveryResponse = await fetch(`${baseURL}/api/users/me`, { signal: AbortSignal.timeout(10_000) })
const recoveryBody = await recoveryResponse.json()
const recoveryMs = performance.now() - recoveryStarted
const result = {
  target: `${baseURL}/api/users/me`,
  classification: 'read-only unauthenticated account-status endpoint',
  ramps: rampResults,
  configuredOperationLimit: ramps.reduce((sum, ramp) => sum + ramp.operations, 0),
  attemptedOperations,
  completedOperations: latencies.length,
  retries: 0,
  peakConcurrency: peakInFlight,
  totalDurationMs,
  throughputOpsPerSecond: totalDurationMs ? latencies.length / (totalDurationMs / 1000) : 0,
  latencyMs: {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    samples: sorted.length,
  },
  errors,
  recovery: {
    status: recoveryResponse.status,
    bodyValid: recoveryBody?.user === null && recoveryBody?.message === 'Account',
    latencyMs: recoveryMs,
  },
  stopConditionTriggered: errors.length > 0,
}
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result))
if (errors.length > 0 || recoveryResponse.status !== 200 || !result.recovery.bodyValid) process.exitCode = 1
