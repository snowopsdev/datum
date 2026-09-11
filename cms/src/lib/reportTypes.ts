/**
 * The shapes the reports page renders, apart from the component that renders
 * them.
 *
 * `reportQueries.ts` runs on the server and used to import these from
 * `ReportsPanel.tsx`, a `'use client'` module: a server query pulling a client
 * component into its module graph for two type aliases. They live here so both
 * sides can import them and neither has to import the other.
 */

export type SpendRow = { label: string; usd: number }

export type CostReport = {
  period: 'week' | 'month' | 'all'
  periodStart: string | null
  rowCount: number
  totalUsd: number
  byStage: SpendRow[]
  byModel: SpendRow[]
}
