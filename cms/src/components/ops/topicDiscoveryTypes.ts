/**
 * Types shared by the discovery panel and its server actions.
 *
 * They live here rather than beside the actions because a `'use server'` module
 * may only export async functions — exporting anything else from it fails the
 * build with "Only async functions are allowed to be exported".
 */

import type { DiscoveredKeyword } from '../../../../pipeline/src/ahrefs'

/** What the panel shows for one candidate, plus whether it is already taken. */
export interface TopicCandidate extends DiscoveredKeyword {
  /** True when an article already exists for this keyword. */
  alreadyTaken: boolean
  /**
   * True when the only article for this keyword was taken off the board.
   * It still blocks a second pick — keywords are one-article-per — but the
   * panel has to say *why*, or removing a topic looks like it did nothing.
   */
  archived: boolean
}

export type DiscoverResult =
  | {
      ok: true
      seed: string
      candidates: TopicCandidate[]
      /** True when this came from cache — the panel says so and offers a refresh. */
      cached: boolean
      fetchedAt: string
    }
  | { ok: false; error: string }

export type CreateTopicsResult =
  | {
      ok: true
      articleId: number
      primary: string
      covered: number
      skipped: number
      /** False when the workspace is not ready to run; the piece still exists. */
      researchQueued: boolean
    }
  | { ok: false; error: string }

/** One previous search, for the "pick up where you left off" list. */
export interface RecentSearch {
  seed: string
  fetchedAt: string
  resultCount: number
}
