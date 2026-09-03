import { bannedWordsOf, brandVoiceToPrompt } from '../brandVoice'
import { completeJSONLogged } from '../llm'
import {
  extractHeadings,
  lexicalToMarkdown,
  lexicalToPlainText,
  type RichText,
} from '../richtext'
import { resolveTemplate, type Stage } from '../stages'
import {
  checkEvidenceRefs,
  type EvidenceBankContent,
  evidenceBankToPrompt,
  icpToPrompt,
  positioningToPrompt,
  selectIcp,
  workspaceProfileToPrompt,
} from '../tenant'

import { runStructuralChecks } from './structuralChecks'
import {
  decideEvidence,
  decideQualitative,
  type EvidenceClaimFinding,
  evidenceRevisionNotes,
  parseEvidenceCheck,
  parseFactCheck,
  parseQualitative,
} from './verdicts'

const BASE_QUALITATIVE_SYSTEM =
  'You are an exacting content editor. Judge whether the article follows the style guide and the template rules. '

const LEGACY_SHAPE = 'Return JSON: {"passed": boolean, "notes": string}.'

const BRAND_VOICE_SHAPE =
  'Also judge brand voice fit against the "Brand voice (tenant)" section: score it 1–5 as voiceScore with a short voiceNotes explanation. ' +
  'List notTraitViolations ONLY for a clear breach of a "What we are NOT" trait; each entry must quote the offending text verbatim as excerpt. ' +
  'If there is no clear breach, return an empty array — do not fail the article on voice fit alone. ' +
  'Return JSON: {"passed": boolean, "notes": string, "voiceScore": number, "voiceNotes": string, "notTraitViolations": [{"trait": string, "excerpt": string, "explanation": string}]}.'

/**
 * Positioning is advisory here, and says so.
 *
 * The avoid vocabulary is a matter of taste and drift is a judgement call, so
 * failing a draft on either would make the reviewer the arbiter of positioning
 * — a decision nobody reviewed. Words that must never appear are the brand
 * voice's banned list instead, which is checked structurally and deterministically.
 */
const POSITIONING_SHAPE =
  " Also note, under notes, any use of the positioning's 'Avoid' vocabulary and any drift from " +
  'the stated position; these are advisory and never fail the article on their own.'

/**
 * The evidence check's brief: a closed-book audit of what the draft says about
 * the workspace itself.
 *
 * Deliberately not folded into `factCheck`. That call searches the open web and
 * judges public claims; this one compares sentences against a list and needs no
 * search at all, which makes it a different skill, a cheaper model, and a
 * verdict half of which is deterministic. Folding them together would make the
 * fact checker's output schema depend on whether a bank exists and would double
 * the cost of the call a workspace already pays most for.
 */
const EVIDENCE_CHECK_SYSTEM =
  'You audit an article for first-party claims. A first-party claim is any statement about ' +
  '{company}, its product, customers, pricing, results, or measurements, or a comparative ' +
  'statement about a named competitor. Public facts about the wider topic are not your concern. ' +
  'Judge each first-party claim against the Evidence bank:\n' +
  '- backed: it restates an entry (cite its ref) within that entry\'s limits;\n' +
  '- overreach: it cites or relies on an entry but goes beyond its limits or changes a number;\n' +
  '- unbacked: no entry supports it;\n' +
  '- rejected: it states, or paraphrases, an entry under "Never state these".\n' +
  'Quote the offending sentence verbatim as excerpt. Return JSON: {"claims": [{"excerpt": string, ' +
  '"kind": "first_party"|"competitor", "status": "backed"|"overreach"|"unbacked"|"rejected", ' +
  '"ref": string|null, "note": string}], "notes": string}. Return an empty claims array when the ' +
  'article makes no first-party claims.'

/** What a draft says it cited, as one line per ref for the auditor to check against. */
function declaredRefsBlock(citations: unknown): string {
  const rows = Array.isArray(citations) ? citations : []
  const lines = rows
    .map((row) => {
      const entry = row as { ref?: unknown; excerpt?: unknown }
      const ref = typeof entry?.ref === 'string' ? entry.ref : ''
      if (!ref) return ''
      const excerpt = typeof entry.excerpt === 'string' ? entry.excerpt : ''
      return excerpt ? `${ref} (${excerpt})` : ref
    })
    .filter(Boolean)
  return lines.length > 0
    ? `Refs the writer declared:\n${lines.join('\n')}`
    : 'Refs the writer declared: none.'
}

/**
 * Attach the "say instead" from the bank to a rejected finding.
 *
 * The model is never shown the replacement as a field, only as prose inside the
 * never-use list, so it cannot be trusted to echo it back. Reading it off the
 * bank is both cheaper and correct.
 */
function withReplacements(
  findings: EvidenceClaimFinding[],
  bank: EvidenceBankContent | null,
): EvidenceClaimFinding[] {
  if (!bank) return findings
  return findings.map((finding) => {
    if (finding.status !== 'rejected' || !finding.ref) return finding
    const row = bank.rejectedClaims.find((entry) => entry.ref === finding.ref)
    return row?.replacement ? { ...finding, replacement: row.replacement } : finding
  })
}

export const qaStage: Stage = {
  name: 'qa',
  entryStatus: 'drafted',
  exitStatus: 'qa_passed',
  async run(article, ctx) {
    const template = resolveTemplate(article)
    const violations = runStructuralChecks(article, template, ctx.styleGuide, {
      brandBannedWords: ctx.brandVoice ? bannedWordsOf(ctx.brandVoice) : [],
    })

    const bodyText = article.body ? lexicalToPlainText(article.body as RichText) : ''
    // Markdown, not plain text, for the qualitative reviewer: templates state
    // structural rules ("each item name belongs in an H2") and plain text drops
    // every heading marker, so the reviewer cannot see heading levels at all. It
    // guesses, and a wrong guess is unrecoverable — structural QA passes, the
    // reviewer fails the same article forever, and every regeneration hits the
    // identical invisible wall. The fact checker keeps plain text: it judges
    // claims, not layout.
    const bodyMarkdown = article.body ? lexicalToMarkdown(article.body as RichText) : ''
    const faqText =
      article.faqItems?.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '(none)'

    // `faqItems` is structured data for search engines, and templates like
    // How-To also require an "FAQ" H2 in the body — so for those the same Q&As
    // legitimately exist twice, once rendered and once as markup. Appending the
    // FAQ block after the body without saying so made every reviewer report the
    // article as repeating itself, an unfixable complaint: removing either copy
    // breaks a rule the template enforces. Say which is which instead.
    const bodyHasFaqSection = article.body
      ? extractHeadings(article.body as RichText).some((h) => /\bfaq\b|frequently asked/i.test(h.text))
      : false
    const faqBlock = bodyHasFaqSection
      ? `FAQ entries (structured data for search engines — these intentionally mirror the article's own FAQ section, so do not report them as duplicated content):\n${faqText}`
      : `FAQ entries (structured data for search engines, not part of the body):\n${faqText}`

    const factResult = await completeJSONLogged(ctx, 'factCheck', article.id, {
      system:
        'You are a rigorous fact checker. Verify the factual claims in the article using web search. ' +
        'Return JSON: {"passed": boolean, "notes": string, "sources": string[]} where sources are the URLs you used.',
      user: `Fact-check this article about "${article.keyword}".\n\nTitle: ${article.title}\n\n${bodyText}\n\n${faqBlock}`,
      needWebSearch: true,
    })
    const factCheck = parseFactCheck(factResult.json)

    const dos = template.dos?.map((d) => `- ${d.text}`).join('\n') || '(none)'
    const donts = template.donts?.map((d) => `- ${d.text}`).join('\n') || '(none)'
    const brandVoiceBlock = ctx.brandVoice ? `\n\n${brandVoiceToPrompt(ctx.brandVoice)}` : ''
    // The same audience block the writer was given. Without it the reviewer
    // judges register and usefulness against a reader it has to invent, and
    // then fails drafts for being pitched at the wrong person.
    const icpBlock = icpToPrompt(selectIcp(ctx.tenant, article))
    const audienceBlock = icpBlock ? `\n\n${icpBlock}` : ''
    // And the same position. A reviewer that cannot see what the company claims
    // to be has no way to tell a drifting draft from a correct one.
    const positioningBlock = positioningToPrompt(ctx.tenant.positioning)
    const positionBlock = positioningBlock ? `\n\n${positioningBlock}` : ''
    // The brand voice governs every generated field, so the meta fields are reviewed too.
    const metaText = [
      `Title tag: ${article.titleTag ?? '(none)'}`,
      `Meta description: ${article.metaDescription ?? '(none)'}`,
      `OG title: ${article.ogTitle ?? '(none)'}`,
      `OG description: ${article.ogDescription ?? '(none)'}`,
    ].join('\n')
    const qualResult = await completeJSONLogged(ctx, 'qualitativeReview', article.id, {
      system:
        BASE_QUALITATIVE_SYSTEM +
        (ctx.brandVoice ? BRAND_VOICE_SHAPE : LEGACY_SHAPE) +
        (positioningBlock ? POSITIONING_SHAPE : ''),
      user: `Style guide:\n${ctx.styleGuide.text}${brandVoiceBlock}${audienceBlock}${positionBlock}\n\nTemplate "${template.name}" dos:\n${dos}\n\nTemplate don'ts:\n${donts}\n\nArticle "${article.title}":\n\n${metaText}\n\n${bodyMarkdown}\n\n${faqBlock}`,
    })
    const qualitativeReview = parseQualitative(qualResult.json)

    // The evidence check, after the fact check: both read the same draft, and
    // running them in this order keeps the cost-log rows in the order a
    // reviewer reads the results. It runs on every article, bank or no bank —
    // an unbacked first-party claim in a workspace with no bank is exactly the
    // thing worth flagging, and the block below says so in as many words.
    const companyName =
      ctx.tenant.profile.companyName || ctx.tenant.profile.targetDomain || 'this company'
    const bankBlock =
      evidenceBankToPrompt(ctx.tenant.evidenceBank, {
        asOf: ctx.tenant.asOf,
        surface: 'web',
        companyName: ctx.tenant.profile.companyName,
        // Uncapped: the writer saw the newest 40 claims, the auditor must see
        // every one, or a claim past the cap reads as unbacked when it is not.
        cap: Infinity,
      }) ?? 'There is no evidence bank for this workspace, so every first-party claim is unbacked.'
    const workspaceBlock = workspaceProfileToPrompt(ctx.tenant.profile)
    const evidenceResult = await completeJSONLogged(ctx, 'evidenceCheck', article.id, {
      system: EVIDENCE_CHECK_SYSTEM.replace('{company}', companyName),
      user: [
        workspaceBlock,
        bankBlock,
        declaredRefsBlock(article.evidenceCitations),
        // The meta fields go to the auditor for the same reason they go to the
        // reviewer: they are generated text about the company, they are the
        // first thing a reader sees, and a title tag is where an unbacked
        // superlative is likeliest to survive a careful body.
        `Article "${article.title}":\n\n${metaText}\n\n${bodyText}`,
        faqBlock,
      ]
        .filter((block) => block.trim().length > 0)
        .join('\n\n'),
    })
    const evidenceVerdict = parseEvidenceCheck(evidenceResult.json)
    const evidence = decideEvidence(
      evidenceVerdict,
      checkEvidenceRefs(
        (Array.isArray(article.evidenceCitations) ? article.evidenceCitations : [])
          .map((row) => (row as { ref?: unknown })?.ref)
          .filter((ref): ref is string => typeof ref === 'string'),
        ctx.tenant.evidenceBank,
        // The surface the writer was given, so a ref cleared for sales only is
        // reported as a clearance problem rather than as a hallucination.
        { asOf: ctx.tenant.asOf, surface: 'web' },
      ),
    )
    const evidenceFindings = withReplacements(evidence.findings, ctx.tenant.evidenceBank)
    // The failing excerpts are appended to the stored notes rather than to the
    // article's `revisionNotes`, because `revisionNotes` is written by the
    // reviewer's regenerate action, from `qaFailures`, and nothing else may
    // touch it without the two racing. `qaFailures` reads these notes, so the
    // next generate prompt still sees them verbatim.
    const revisionLines = evidence.passed ? '' : evidenceRevisionNotes(evidenceFindings)
    const evidenceNotes = [evidenceVerdict.notes, revisionLines]
      .filter((part) => part.trim().length > 0)
      .join('\n\n')

    // Sum after the QA calls so this article's own factCheck/qualitativeReview
    // rows are included in its total.
    const costRows = await ctx.payload.find({
      collection: 'cost-log',
      where: { article: { equals: article.id } },
      pagination: false,
      depth: 0,
    })
    const totalCostUsd = costRows.docs.reduce((sum, row) => sum + (row.costUsd ?? 0), 0)

    const structuralPassed = violations.length === 0
    const allPassed =
      structuralPassed &&
      factCheck.passed &&
      decideQualitative(qualitativeReview) &&
      evidence.passed
    return {
      status: allPassed ? 'qa_passed' : 'needs_revision',
      data: {
        qaResults: {
          structural: { passed: structuralPassed, violations },
          factCheck: {
            passed: factCheck.passed,
            notes: factCheck.notes,
            sources: factCheck.sources,
          },
          qualitativeReview,
          evidenceCheck: {
            passed: evidence.passed,
            notes: evidenceNotes,
            claims: evidenceFindings,
          },
        },
        qaModels: {
          factCheck: factResult.model,
          qualitativeReview: qualResult.model,
          evidenceCheck: evidenceResult.model,
        },
        totalCostUsd,
      },
    }
  },
}
