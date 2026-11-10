/**
 * What the actions that throw a draft away write to the article.
 *
 * Here rather than in `actions.ts` because a `'use server'` module may export
 * only async functions, and `briefActions.ts` (revisiting a brief) clears the
 * same fields as reset and regenerate do.
 */

export const NULL_QA_RESULTS = {
  structural: { passed: null, violations: null },
  factCheck: { passed: null, notes: null, sources: null },
  qualitativeReview: {
    passed: null,
    notes: null,
    voiceScore: null,
    voiceNotes: null,
    notTraitViolations: null,
  },
  // Without this the evidence verdict of the draft being thrown away stays on
  // the article, and the review page shows it against text QA has not seen.
  evidenceCheck: { passed: null, notes: null, claims: null },
} as const

/**
 * What every action that moves an article off `approved` writes to `publishAt`.
 *
 * A schedule is inert on any other status, which made leaving it in place look
 * free — and it is, right up to the moment the piece is approved a second
 * time. Then the five-minute `publish-due` tick finds a date that passed days
 * ago, publishes immediately, and the reviewer who had not finished looking at
 * the draft gets no say and no explanation. Taking the date back at the moment
 * it stops applying is the only point where the intent is unambiguous: the
 * person sending this piece back has just said it is not ready to go out.
 *
 * The audit details record the write (`publishAt: null`) the same way they
 * already record `reviewNotes` — what the action wrote, not a claim about what
 * was there before.
 */
export const CLEARED_SCHEDULE = { publishAt: null } as const
