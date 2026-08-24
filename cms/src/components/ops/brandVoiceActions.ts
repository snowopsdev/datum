'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { randomUUID } from 'node:crypto'

import { parseBrandVoiceContent } from '../../lib/brandVoice'
import {
  BrandVoiceExtractionError,
  extractBrandVoiceFromText,
  logExtractionCost,
} from '../../lib/brandVoiceExtract'
import { detectKind, extractText, UnsupportedUploadError } from '../../lib/extractText'
import type { BrandVoiceInput } from './brandVoiceTypes'

const VIEW_PATH = '/admin/ops/governance/brand-voice'

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Unauthorized')
  return { payload, user }
}

function governanceAuditContext(
  user: { email?: string | null; id: number | string },
  event: string,
  summary: string,
  details?: Record<string, unknown>,
) {
  return {
    governanceAudit: {
      actor: typeof user.email === 'string' ? user.email : String(user.id),
      actorType: 'user' as const,
      event,
      summary,
      details,
    },
  }
}

function toData(input: BrandVoiceInput) {
  const { content } = parseBrandVoiceContent(input)
  return {
    ...content,
    name: content.name || 'Untitled brand voice',
    ...(typeof input.onboardingStep === 'number'
      ? { onboardingStep: Math.max(0, Math.min(9, Math.round(input.onboardingStep))) }
      : {}),
  }
}

function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message
  }
  return fallback
}

export async function createBrandVoiceDraftAction(input: BrandVoiceInput): Promise<{ id: number }> {
  const { payload, user } = await requireUser()
  const doc = await payload.create({
    collection: 'brand-voices',
    data: { ...toData(input), status: 'draft', source: 'onboarding' },
    context: governanceAuditContext(user, 'brand_voice_created', 'Onboarding started', {
      step: input.onboardingStep ?? 0,
    }),
    user,
    overrideAccess: false,
  })
  revalidatePath(VIEW_PATH)
  return { id: doc.id }
}

export async function saveBrandVoiceDraftAction(id: number, input: BrandVoiceInput): Promise<void> {
  const { payload, user } = await requireUser()
  await payload.update({
    collection: 'brand-voices',
    id,
    data: toData(input),
    context: governanceAuditContext(user, 'brand_voice_updated', 'Brand voice saved', {
      step: input.onboardingStep ?? null,
    }),
    user,
    overrideAccess: false,
  })
  revalidatePath(VIEW_PATH)
}

export async function activateBrandVoiceAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { payload, user } = await requireUser()
  try {
    await payload.update({
      collection: 'brand-voices',
      id,
      data: { status: 'active' },
      context: governanceAuditContext(user, 'brand_voice_activated', 'Brand voice activated'),
      user,
      overrideAccess: false,
    })
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Activation failed') }
  }
  revalidatePath(VIEW_PATH)
  return { ok: true }
}

export async function archiveBrandVoiceAction(id: number): Promise<void> {
  const { payload, user } = await requireUser()
  await payload.update({
    collection: 'brand-voices',
    id,
    data: { status: 'archived' },
    context: governanceAuditContext(user, 'brand_voice_archived', 'Brand voice archived'),
    user,
    overrideAccess: false,
  })
  revalidatePath(VIEW_PATH)
}

/** Canonical mimetypes accepted by the `brand-voice-files` upload collection. */
const UPLOAD_MIMETYPES = {
  md: 'text/markdown',
  txt: 'text/plain',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const

export type UploadExtractResult =
  | { ok: true; id: number; warnings: string[] }
  | { ok: false; error: string }

/**
 * The "upload an existing asset" path: store the file, pull its text, run one
 * extraction call, and save the result as a draft for review. Never activates.
 */
export async function extractBrandVoiceFromUploadAction(
  formData: FormData,
): Promise<UploadExtractResult> {
  const { payload, user } = await requireUser()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a .md, .txt, .pdf, or .docx file to upload.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let extracted
  try {
    extracted = await extractText(buffer, file.type, file.name)
  } catch (e) {
    if (e instanceof UnsupportedUploadError) return { ok: false, error: e.message }
    return { ok: false, error: errorMessage(e, `Could not read "${file.name}"`) }
  }
  if (!extracted.text) {
    return { ok: false, error: `"${file.name}" contains no readable text.` }
  }

  const kind = detectKind(file.name, file.type) ?? extracted.kind
  const stored = await payload.create({
    collection: 'brand-voice-files',
    data: { description: `Brand guide uploaded by ${user.email ?? user.id}` },
    file: { data: buffer, mimetype: UPLOAD_MIMETYPES[kind], name: file.name, size: buffer.length },
    user,
    overrideAccess: false,
  })

  const runId = `brand-voice-extract:${randomUUID()}`
  const request = { filename: file.name, sourceChars: extracted.sourceChars }
  let result
  try {
    result = await extractBrandVoiceFromText({ text: extracted.text, filename: file.name })
  } catch (e) {
    if (e instanceof BrandVoiceExtractionError) {
      // The call was billed even though the reply was unusable — record it.
      await logExtractionCost(payload, runId, e.billed, request)
      return { ok: false, error: e.message }
    }
    return { ok: false, error: errorMessage(e, 'Brand voice extraction failed') }
  }
  await logExtractionCost(payload, runId, result, request)

  const warnings = extracted.truncated
    ? [`Only the first ${extracted.text.length.toLocaleString()} characters were read`, ...result.warnings]
    : result.warnings
  const { content } = parseBrandVoiceContent(result.content)
  const doc = await payload.create({
    collection: 'brand-voices',
    data: {
      ...content,
      name: content.name || file.name.replace(/\.[a-z0-9]+$/i, ''),
      status: 'draft',
      source: 'upload',
      sourceFile: stored.id,
      onboardingStep: 9,
      extraction: {
        model: result.model,
        provider: result.provider,
        extractedAt: new Date().toISOString(),
        sourceChars: extracted.sourceChars,
        warnings,
      },
    },
    context: governanceAuditContext(user, 'brand_voice_extracted', 'Draft extracted from uploaded guide', {
      fileId: stored.id,
      filename: file.name,
      kind,
      model: result.model,
      provider: result.provider,
      warnings,
    }),
    user,
    overrideAccess: false,
  })
  revalidatePath(VIEW_PATH)
  return { ok: true, id: doc.id, warnings }
}

export async function deleteDraftAction(id: number): Promise<void> {
  const { payload, user } = await requireUser()
  const doc = await payload.findByID({
    collection: 'brand-voices',
    id,
    depth: 0,
    user,
    overrideAccess: false,
  })
  if (doc.status !== 'draft') {
    throw new Error('Only drafts can be deleted. Archive an active brand voice instead.')
  }
  await payload.delete({ collection: 'brand-voices', id, user, overrideAccess: false })
  revalidatePath(VIEW_PATH)
}
