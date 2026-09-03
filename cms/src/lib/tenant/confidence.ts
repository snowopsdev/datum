/**
 * How sure the workspace is about a statement it hands the writer.
 *
 * One shared scale for every tenant asset, because the writer needs a single
 * rule for what it may assert: a level does not just record provenance, it
 * dictates the grammar of the sentence the model is allowed to produce. The
 * mapping in `CONFIDENCE_USAGE` is that rule, and it is rendered as a legend
 * next to any block that carries confidences.
 *
 * Dependency-free: the admin UI and the pipeline both import it.
 */

export const CONFIDENCE_LEVELS = [
  'verified',
  'strong_directional',
  'qualitative_pattern',
  'cultural_signal',
  'inference',
  'hypothesis',
] as const

export type Confidence = (typeof CONFIDENCE_LEVELS)[number]

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  verified: 'Verified',
  strong_directional: 'Strong directional',
  qualitative_pattern: 'Qualitative pattern',
  cultural_signal: 'Cultural signal',
  inference: 'Inference',
  hypothesis: 'Hypothesis',
}

/**
 * `state` — assert it plainly. `hedge` — assert it as a tendency ("a pattern we
 * see", "often"). `frame_as_view` — attribute it to us ("in our reading"),
 * never as fact.
 */
export type ConfidenceUsage = 'state' | 'hedge' | 'frame_as_view'

export const CONFIDENCE_USAGE: Record<Confidence, ConfidenceUsage> = {
  verified: 'state',
  strong_directional: 'state',
  qualitative_pattern: 'hedge',
  cultural_signal: 'hedge',
  inference: 'frame_as_view',
  hypothesis: 'frame_as_view',
}

export const CONFIDENCE_USAGE_HINT: Record<ConfidenceUsage, string> = {
  state: 'state it plainly',
  hedge: 'state it as a tendency, not a fact',
  frame_as_view: 'attribute it to us, never as fact',
}

/** Admin `select` options, in scale order. */
export const CONFIDENCE_OPTIONS: readonly { label: string; value: Confidence }[] =
  CONFIDENCE_LEVELS.map((value) => ({ label: CONFIDENCE_LABEL[value], value }))

/** Narrows arbitrary stored data; anything unrecognised is treated as unset. */
export function confidenceOf(value: unknown): Confidence | null {
  return typeof value === 'string' && (CONFIDENCE_LEVELS as readonly string[]).includes(value)
    ? (value as Confidence)
    : null
}

/** How a level is written inside a prompt block: `[strong directional]`. */
export function confidenceTag(level: Confidence): string {
  return `[${level.replace(/_/g, ' ')}]`
}

/**
 * The legend emitted above every block that carries confidence tags.
 *
 * Derived from `CONFIDENCE_USAGE` rather than written out, so adding a level
 * cannot leave the writer with a tag the legend never explains.
 */
export const CONFIDENCE_LEGEND: string = (() => {
  const order: ConfidenceUsage[] = ['state', 'hedge', 'frame_as_view']
  const clauses = order.map((usage) => {
    const tags = CONFIDENCE_LEVELS.filter((level) => CONFIDENCE_USAGE[level] === usage)
      .map(confidenceTag)
      .join('/')
    return `${tags} ${CONFIDENCE_USAGE_HINT[usage]}`
  })
  return `Confidence tags say how you may use a line: ${clauses.join('; ')}.`
})()
