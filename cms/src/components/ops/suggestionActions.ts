'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '../../lib/requireUser'
import { errorMessage } from '../../lib/errorMessage'
import { collectSetupSuggestions, suggestionAssets } from '../../lib/setupSuggestions/collect'
import { decideSuggestion, requireSuggestionAdmin } from '../../lib/setupSuggestions/decisions'
import { saveBrandVoiceDraftAction } from './brandVoiceActions'
import { saveEvidenceBankAction } from './tenantActions'
import type { SuggestionActionResult } from './suggestionTypes'
const NEVER_SAVED = new Date(0).toISOString()
const CHANGED_MESSAGE =
  'Someone else saved this since you opened it. Reload to see their changes, then accept again.'
const refresh = () => {
  revalidatePath('/admin')
  revalidatePath('/admin/ops/setup')
}
export async function scanSuggestionsAction(): Promise<SuggestionActionResult> {
  try {
    const { payload, user } = await requireUser('Sign in first.')
    requireSuggestionAdmin(user)
    await collectSetupSuggestions(payload)
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not scan corrections.') }
  }
}
export async function acceptSuggestionAction(
  id: number,
  options: { evidenceAs?: 'verified' | 'rejected'; reason?: string } = {},
): Promise<SuggestionActionResult> {
  try {
    const { payload, user } = await requireUser('Sign in first.')
    requireSuggestionAdmin(user)
    const row = await payload.findByID({
      collection: 'setup-suggestions',
      id,
      overrideAccess: true,
    })
    if (row.status !== 'open')
      return { ok: false, error: 'This suggestion has already been decided.' }
    const p = (row.proposal ?? {}) as Record<string, unknown>
    const assets = await suggestionAssets(payload)
    if (row.kind === 'not_trait') {
      if (!assets.voice) return { ok: false, error: 'Activate a brand voice first.' }
      return {
        ok: true,
        editorHref: `/admin/ops/setup/brand-voice?id=${assets.voice.id}&mode=review&suggestionId=${id}`,
      }
    }
    if (row.kind === 'rejected_ref')
      return { ok: true, editorHref: `/admin/ops/setup/evidence?suggestionId=${id}` }
    if (row.kind === 'banned_word') {
      if (!assets.voice || !assets.voiceContent)
        return { ok: false, error: 'Activate a brand voice first.' }
      const phrase = typeof p.phrase === 'string' ? p.phrase.trim() : ''
      if (!phrase) throw new Error('The suggestion has no phrase.')
      const banned = assets.voiceContent.bannedWords
      // The write below replaces the whole voice from what was read above, so
      // a voice saved in between would be silently reverted. Read it again as
      // close to the write as possible and refuse if it moved.
      const latest = await payload.findByID({
        collection: 'brand-voices',
        id: assets.voice.id,
        select: { updatedAt: true },
        depth: 0,
        overrideAccess: true,
      })
      if (latest.updatedAt !== assets.voice.updatedAt) return { ok: false, error: CHANGED_MESSAGE }
      // The save answers a refusal as a value now; without this check the
      // suggestion would be marked accepted with the word never written.
      const saved = await saveBrandVoiceDraftAction(assets.voice.id, {
        ...assets.voiceContent,
        onboardingStep: assets.voice.onboardingStep ?? 0,
        bannedWords: banned.some((w) => w.word.toLowerCase() === phrase.toLowerCase())
          ? banned
          : [...banned, { word: phrase, note: 'Removed repeatedly by reviewers' }],
      })
      if (!saved.ok) return { ok: false, error: saved.error }
    } else if (row.kind === 'unbacked_claim') {
      const claim = typeof p.claim === 'string' ? p.claim.trim() : ''
      if (!claim) throw new Error('The suggestion has no claim.')
      if (options.evidenceAs === 'rejected' && !options.reason?.trim())
        return { ok: false, error: 'Give a reason for rejecting this claim.' }
      const bank = assets.bank
      const exists = [
        ...bank.verifiedClaims.map((c) => c.claim),
        ...bank.rejectedClaims.map((c) => c.claim),
      ].some((c) => c.toLowerCase() === claim.toLowerCase())
      if (!exists) {
        // Pass the version read above: the save refuses if the bank has moved on.
        const saved = await saveEvidenceBankAction(
          {
            ...bank,
            verifiedClaims:
              options.evidenceAs === 'rejected'
                ? bank.verifiedClaims
                : [
                    ...bank.verifiedClaims,
                    {
                      ref: '',
                      claim,
                      primarySource: '',
                      sourceUrl: '',
                      sourceDate: '',
                      sampleOrMethod: '',
                      verificationDepth: 'self_reported',
                      limits: '',
                      clearedSurfaces: [],
                      recheckAt: '',
                    },
                  ],
            rejectedClaims:
              options.evidenceAs === 'rejected'
                ? [
                    ...bank.rejectedClaims,
                    {
                      ref: '',
                      claim,
                      status: 'rejected',
                      reason: options.reason!.trim(),
                      replacement: '',
                    },
                  ]
                : bank.rejectedClaims,
          },
          undefined,
          // A bank never saved has no `updatedAt`; the epoch stands for "never
          // saved" so a first save landing in the window still counts as a change.
          assets.bankDoc.updatedAt ?? NEVER_SAVED,
        )
        if (!saved.ok) throw new Error(saved.error)
      }
    } else throw new Error('Unknown suggestion kind.')
    await decideSuggestion(payload, user, row, 'accepted')
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not accept this suggestion.') }
  }
}
export async function dismissSuggestionAction(
  id: number,
  reason?: string,
): Promise<SuggestionActionResult> {
  try {
    const { payload, user } = await requireUser('Sign in first.')
    requireSuggestionAdmin(user)
    const row = await payload.findByID({
      collection: 'setup-suggestions',
      id,
      overrideAccess: true,
    })
    if (row.status !== 'open')
      return { ok: false, error: 'This suggestion has already been decided.' }
    await decideSuggestion(payload, user, row, 'dismissed', reason?.trim())
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not dismiss this suggestion.') }
  }
}
