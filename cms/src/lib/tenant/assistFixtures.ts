/**
 * What the setup assistant returns when nobody has paid for a model.
 *
 * Mock mode is the local default, so this is the reply most people will ever
 * see from "Draft with AI": the demo workspace's own section, put through the
 * same `parseAssistReply` a live reply goes through. Running it through the
 * parser rather than returning the fixture raw is the point — the mock then
 * demonstrates the real rules (confidence capped at `inference`, evidence rows
 * unverified and unref'd) instead of a cleaner record than a model could ever
 * produce.
 *
 * Kept out of `lib/tenant/index.ts`, like `fixtures.ts`, so demo data cannot
 * reach a production bundle by way of the pipeline's re-export.
 */

import {
  type AssistAsset,
  type AssistInput,
  parseAssistReply,
} from './assist'
import {
  EVIDENCE_BANK_FIXTURE,
  ICP_FIXTURE,
  POSITIONING_FIXTURE,
  WORKSPACE_PROFILE_FIXTURE,
} from './fixtures'

export const ASSIST_MOCK_WARNING =
  'Mock mode: returned the demo section instead of calling the model'

/** The demo workspace as one loose record per asset, ready to be sliced. */
const FIXTURE_CONTENT: Record<AssistAsset, Record<string, unknown>> = {
  workspace: {
    companyName: WORKSPACE_PROFILE_FIXTURE.companyName,
    competitors: WORKSPACE_PROFILE_FIXTURE.competitors,
    siteNotes: WORKSPACE_PROFILE_FIXTURE.siteNotes,
  },
  icp: { ...ICP_FIXTURE },
  positioning: { ...POSITIONING_FIXTURE },
  evidence: { ...EVIDENCE_BANK_FIXTURE },
}

/**
 * The demo section for this request.
 *
 * A refine merges over whatever the operator already had, the same way a live
 * refine is asked to keep what the notes do not contradict: the button stays
 * additive in mock mode instead of quietly replacing a half-typed step.
 */
export function assistMock(input: AssistInput): {
  value: Record<string, unknown>
  warnings: string[]
} {
  const { value } = parseAssistReply(input.asset, input.section, FIXTURE_CONTENT[input.asset], {
    // The fixture's own URLs are the material here, so nothing it carries is
    // dropped for being uncited.
    sourceTexts: [JSON.stringify(FIXTURE_CONTENT[input.asset])],
  })
  const current =
    input.mode === 'refine' && input.current && typeof input.current === 'object' && !Array.isArray(input.current)
      ? (input.current as Record<string, unknown>)
      : {}
  return { value: { ...current, ...value }, warnings: [ASSIST_MOCK_WARNING] }
}
