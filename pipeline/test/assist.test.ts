import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ASSIST_PAGE_TEXT_CAP,
  ASSIST_SECTIONS,
  type AssistContext,
  assistSectionKeys,
  buildAssistPrompt,
  isAssistAsset,
  isAssistSection,
  parseAssistReply,
  pickAssistSection,
  type AssistAsset,
  type AssistInput,
} from '../../cms/src/lib/tenant/assist'
import { ASSIST_MOCK_WARNING, assistMock } from '../../cms/src/lib/tenant/assistFixtures'
import {
  EVIDENCE_BANK_FIXTURE,
  ICP_FIXTURE,
  ICP_FIXTURE_SECONDARY,
  POSITIONING_FIXTURE,
} from '../../cms/src/lib/tenant/fixtures'
import { resolveWorkspaceProfile, type SitePage } from '../../cms/src/lib/tenant/workspaceProfile'
import { BRAND_VOICE_FIXTURE } from '../../cms/src/lib/brandVoiceFixture'

const page = (path: string, title: string, text: string): SitePage => ({
  url: `https://datum.example.com${path}`,
  title,
  text,
  fetchedAt: '2026-09-02T00:00:00.000Z',
})

const context = (over: Partial<AssistContext> = {}): AssistContext => ({
  profile: resolveWorkspaceProfile(
    { companyName: 'Datum', targetDomain: 'datum.example.com', sitePages: over.profile?.sitePages },
    {},
  ),
  brandVoice: null,
  icps: [],
  positioning: null,
  evidenceBank: null,
  asOf: '2026-09-02',
  ...over,
})

const draft = (over: Partial<AssistInput> = {}): AssistInput => ({
  asset: 'icp',
  section: 'pains',
  mode: 'draft',
  notes: '',
  current: undefined,
  ...over,
})

describe('ASSIST_SECTIONS', () => {
  it('names every section the editors step through, and nothing else', () => {
    assert.deepEqual(ASSIST_SECTIONS.workspace, ['profile'])
    assert.deepEqual(ASSIST_SECTIONS.icp, [
      'who',
      'pains',
      'motivation',
      'solution',
      'competition',
      'whyUs',
      'channels',
      'boundaries',
      'all',
    ])
    assert.deepEqual(ASSIST_SECTIONS.positioning, [
      'core',
      'frame',
      'coreClaims',
      'pillars',
      'identity',
      'language',
      'openRulings',
      'all',
    ])
    assert.deepEqual(ASSIST_SECTIONS.evidence, ['facts', 'verifiedClaims'])
  })

  it('accepts only its own sections', () => {
    assert.equal(isAssistAsset('icp'), true)
    assert.equal(isAssistAsset('brandVoice'), false)
    assert.equal(isAssistSection('icp', 'pains'), true)
    // A real section of another asset is still wrong for this one.
    assert.equal(isAssistSection('icp', 'pillars'), false)
    assert.equal(isAssistSection('evidence', 'rejectedClaims'), false)
  })

  it('maps the boundaries step onto both of its fields', () => {
    assert.deepEqual(assistSectionKeys('icp', 'boundaries'), ['churnTriggers', 'notOurUser'])
    assert.deepEqual(pickAssistSection('icp', 'boundaries', { ...ICP_FIXTURE }), {
      churnTriggers: ICP_FIXTURE.churnTriggers,
      notOurUser: ICP_FIXTURE.notOurUser,
    })
  })

  it('throws on a section nobody defined', () => {
    assert.throws(
      () => assistSectionKeys('icp', 'vibes'),
      /Unknown assist section "vibes" for asset "icp"/,
    )
  })
})

describe('buildAssistPrompt: the system half', () => {
  it('states only the keys this section owns', () => {
    const { system } = buildAssistPrompt(draft({ section: 'motivation' }), context())
    assert.match(system, /"motivation": \{ "text": string, "hypothesis": boolean/)
    assert.equal(system.includes('"pains"'), false)
    assert.equal(system.includes('"channels"'), false)
  })

  it('teaches what the section means, not just its shape', () => {
    const competition = buildAssistPrompt(draft({ section: 'competition' }), context()).system
    assert.match(competition, /dated verbatims/)
    const identity = buildAssistPrompt(
      draft({ asset: 'positioning', section: 'identity' }),
      context(),
    ).system
    assert.match(identity, /never a named rival/)
    const core = buildAssistPrompt(draft({ asset: 'positioning', section: 'core' }), context()).system
    assert.match(core, /mental slot to own/)
    const motivation = buildAssistPrompt(draft({ section: 'motivation' }), context()).system
    assert.match(motivation, /hypothesis until/)
  })

  it('offers only the confidence levels a model is allowed to use', () => {
    const { system } = buildAssistPrompt(draft({ section: 'pains' }), context())
    assert.match(system, /"qualitative_pattern" \| "cultural_signal" \| "inference" \| "hypothesis"/)
    assert.equal(system.includes('"verified"'), false)
    assert.equal(system.includes('"strong_directional"'), false)
    assert.match(system, /the highest you may use is "inference"/)
  })

  it('leaves the confidence rule off a section that carries no confidence', () => {
    const { system } = buildAssistPrompt(draft({ asset: 'positioning', section: 'pillars' }), context())
    assert.equal(system.includes('confidence'), false)
  })

  it('binds the evidence rules to the evidence sections', () => {
    const claims = buildAssistPrompt(
      draft({ asset: 'evidence', section: 'verifiedClaims' }),
      context(),
    ).system
    assert.match(claims, /Never set "ref", "verificationDepth", or "recheckAt"/)
    assert.match(claims, /Give "sourceUrl" only when that exact URL appears/)
    const pains = buildAssistPrompt(draft({ section: 'pains' }), context()).system
    assert.equal(pains.includes('verificationDepth'), false)
  })

  it('always forbids invention and prose', () => {
    for (const asset of Object.keys(ASSIST_SECTIONS) as AssistAsset[]) {
      for (const section of ASSIST_SECTIONS[asset]) {
        const { system } = buildAssistPrompt(draft({ asset, section }), context())
        assert.match(system, /Never invent facts/, `${asset}/${section}`)
        assert.match(system, /name that page's path/, `${asset}/${section}`)
        assert.match(system, /Reply with only the JSON object/, `${asset}/${section}`)
      }
    }
  })

  it('says draft or revise, matching the button that was pressed', () => {
    assert.match(buildAssistPrompt(draft(), context()).system, /You draft one section/)
    assert.match(
      buildAssistPrompt(draft({ mode: 'refine' }), context()).system,
      /You revise one section/,
    )
  })
})

describe('buildAssistPrompt: the user half', () => {
  it('leads with the operator\'s notes', () => {
    const { user } = buildAssistPrompt(draft({ notes: '  we sell to ops teams  ' }), context())
    assert.match(user, /^## Your notes\nwe sell to ops teams\n/)
  })

  it('says so when there are no notes rather than sending an empty heading', () => {
    const { user } = buildAssistPrompt(draft({ notes: '' }), context())
    assert.match(user, /^## Your notes\n\(none\)/)
  })

  it('renders what the workspace already holds with the pipeline\'s own renderers', () => {
    const { user } = buildAssistPrompt(
      draft(),
      context({
        brandVoice: BRAND_VOICE_FIXTURE,
        positioning: POSITIONING_FIXTURE,
        evidenceBank: EVIDENCE_BANK_FIXTURE,
      }),
    )
    assert.match(user, /## What we already know/)
    assert.match(user, /# Workspace\nCompany: Datum \(datum\.example\.com\)/)
    assert.match(user, /# Brand voice \(tenant\)/)
    assert.match(user, /# Positioning/)
    assert.match(user, /# Evidence bank \(the only first-party facts you may state about Datum\)/)
  })

  it('carries the other audiences and never the one being edited', () => {
    // The action drops the edited record before it builds the context, so what
    // arrives here is exactly "the others".
    const { user } = buildAssistPrompt(
      draft({ section: 'who', icpId: 1 }),
      context({ icps: [ICP_FIXTURE_SECONDARY] }),
    )
    assert.match(user, /# Audience: Founder writing the blog themselves/)
    assert.equal(user.includes(ICP_FIXTURE.name), false)
  })

  it('caps each site page and names the page it came from', () => {
    const long = 'a'.repeat(ASSIST_PAGE_TEXT_CAP + 500)
    const { user } = buildAssistPrompt(
      draft(),
      context({
        profile: resolveWorkspaceProfile(
          {
            targetDomain: 'datum.example.com',
            sitePages: [page('/about', 'About Datum', long), page('/pricing', 'Pricing', 'Plans.')],
          },
          {},
        ),
      }),
    )
    assert.match(user, /## Pages from datum\.example\.com/)
    assert.match(user, /### About Datum\nhttps:\/\/datum\.example\.com\/about\n/)
    assert.match(user, /### Pricing/)
    assert.equal(user.includes('a'.repeat(ASSIST_PAGE_TEXT_CAP + 1)), false)
    assert.equal(user.includes('a'.repeat(ASSIST_PAGE_TEXT_CAP)), true)
  })

  it('omits the pages section entirely when nothing has been fetched', () => {
    const { user } = buildAssistPrompt(draft(), context())
    assert.equal(user.includes('## Pages from'), false)
  })

  it('shows the current draft only when refining', () => {
    const current = { pains: [{ statement: 'Briefing takes a day' }] }
    const refine = buildAssistPrompt(draft({ mode: 'refine', current }), context()).user
    assert.match(refine, /## Current draft of this section/)
    assert.match(refine, /"statement": "Briefing takes a day"/)
    assert.match(refine, /Revise it applying the notes; keep what the notes do not contradict\./)

    const fresh = buildAssistPrompt(draft({ current }), context()).user
    assert.equal(fresh.includes('## Current draft of this section'), false)
    assert.equal(fresh.includes('Briefing takes a day'), false)
  })

  it('refuses a section it does not know before it builds anything', () => {
    assert.throws(() => buildAssistPrompt(draft({ section: 'vibes' }), context()), /Unknown assist section/)
  })
})

describe('parseAssistReply: the audience', () => {
  it('caps anything the model claimed as a finding', () => {
    const { value } = parseAssistReply('icp', 'pains', {
      pains: [
        { statement: 'Briefing eats a day', confidence: 'verified' },
        { statement: 'They cannot attribute a post', confidence: 'strong_directional' },
        { statement: 'They publish late', confidence: 'cultural_signal' },
      ],
    })
    assert.deepEqual(
      (value.pains as { confidence: string }[]).map((row) => row.confidence),
      ['inference', 'inference', 'cultural_signal'],
    )
  })

  it('accepts the bare list a model tends to reply with', () => {
    const { value } = parseAssistReply('icp', 'pains', [{ statement: 'Briefing eats a day' }])
    assert.equal((value.pains as unknown[]).length, 1)
  })

  it('returns only the section, whatever else the reply carried', () => {
    const { value } = parseAssistReply('icp', 'who', {
      who: 'The one person who owns content',
      pains: [{ statement: 'not this section' }],
      name: 'nor this',
    })
    assert.deepEqual(value, { who: 'The one person who owns content' })
  })

  it('warns instead of crashing on a reply about something else', () => {
    const { value, warnings } = parseAssistReply('icp', 'pains', { thoughts: 'I could not say' })
    assert.deepEqual(value, { pains: [] })
    assert.match(warnings.join('\n'), /contained none of the expected keys \(pains\)/)
  })

  it('survives a reply that is not an object at all', () => {
    for (const reply of [null, 'sorry', 42, undefined]) {
      const { value } = parseAssistReply('icp', 'motivation', reply)
      assert.deepEqual(value, { motivation: { text: '', hypothesis: false, confidence: null } })
    }
  })
})

describe('parseAssistReply: positioning', () => {
  it('keeps the claims and drops the citations nobody checked', () => {
    const { value, warnings } = parseAssistReply('positioning', 'coreClaims', {
      coreClaims: [
        { claim: 'Every claim is sourced', evidenceRef: 'E4' },
        { claim: 'A person approves the brief' },
      ],
    })
    assert.deepEqual(value.coreClaims, [
      { claim: 'Every claim is sourced', evidenceRef: '' },
      { claim: 'A person approves the brief', evidenceRef: '' },
    ])
    assert.match(warnings.join('\n'), /Dropped 1 evidence ref/)
  })

  it('takes the five core fields together and nothing beside them', () => {
    const { value } = parseAssistReply('positioning', 'core', {
      category: 'governed content pipeline',
      goal: 'be the default',
      promise: 'Every article can be defended',
      activePosition: 'the pipeline with a reviewer gate',
      statement: 'For marketing leads, Datum is…',
      enemy: 'publishing at volume',
    })
    assert.deepEqual(Object.keys(value), [
      'category',
      'goal',
      'promise',
      'activePosition',
      'statement',
    ])
    assert.equal(value.activePosition, 'the pipeline with a reviewer gate')
  })
})

describe('parseAssistReply: the evidence bank', () => {
  const reply = (over: Record<string, unknown> = {}) => ({
    verifiedClaims: [
      {
        claim: 'The median article costs under two dollars',
        primarySource: 'Cost-log export',
        verificationDepth: 'primary_document',
        recheckAt: '2027-01-31',
        ref: 'E9',
        ...over,
      },
    ],
  })

  it('proposes claims a person still has to verify', () => {
    const { value, warnings } = parseAssistReply('evidence', 'verifiedClaims', reply())
    const [claim] = value.verifiedClaims as Record<string, unknown>[]
    assert.equal(claim.verificationDepth, 'self_reported')
    assert.equal(claim.recheckAt, '')
    assert.equal(claim.ref, '')
    assert.match(warnings.join('\n'), /Proposed claims are unverified/)
  })

  it('keeps a source URL the material actually contains', () => {
    const url = 'https://datum.example.com/pricing'
    const { value } = parseAssistReply('evidence', 'verifiedClaims', reply({ sourceUrl: url }), {
      sourceTexts: [`Our plans are listed at ${url} and nowhere else.`],
    })
    assert.equal((value.verifiedClaims as Record<string, unknown>[])[0].sourceUrl, url)
  })

  it('drops a source URL nobody wrote down, and says so', () => {
    const { value, warnings } = parseAssistReply(
      'evidence',
      'verifiedClaims',
      reply({ sourceUrl: 'https://datum.example.com/reports/2026-q2.pdf' }),
      { sourceTexts: ['We measured it internally.'] },
    )
    assert.equal((value.verifiedClaims as Record<string, unknown>[])[0].sourceUrl, '')
    assert.match(warnings.join('\n'), /Dropped 1 source URL that does not appear/)
  })

  it('never hands back a ref, on facts either', () => {
    const { value } = parseAssistReply('evidence', 'facts', {
      facts: [{ fact: 'Datum runs on Postgres', ref: 'F2', source: 'Architecture' }],
    })
    assert.deepEqual(value.facts, [
      { ref: '', fact: 'Datum runs on Postgres', source: 'Architecture', owner: '', lastConfirmedAt: '' },
    ])
  })

  it('keeps the rows even though the reply carried no refs at all', () => {
    const { value } = parseAssistReply('evidence', 'verifiedClaims', {
      verifiedClaims: [{ claim: 'One' }, { claim: 'Two' }],
    })
    assert.equal((value.verifiedClaims as unknown[]).length, 2)
  })
})

describe('parseAssistReply: the workspace profile', () => {
  it('normalises the competitors the way an operator\'s own typing is normalised', () => {
    const { value } = parseAssistReply('workspace', 'profile', {
      companyName: ' Datum ',
      siteNotes: 'A governed content pipeline.',
      competitors: [
        { domain: 'https://Competitor-One.com/pricing', name: 'Competitor One' },
        { domain: 'competitor-one.com' },
      ],
    })
    assert.equal(value.companyName, 'Datum')
    assert.deepEqual(value.competitors, [{ domain: 'competitor-one.com', name: 'Competitor One' }])
  })

  it('drops a competitor with no usable domain and names it', () => {
    const { value, warnings } = parseAssistReply('workspace', 'profile', {
      competitors: [{ name: 'That agency down the road' }],
    })
    assert.deepEqual(value.competitors, [])
    assert.match(warnings.join('\n'), /Dropped competitor "That agency down the road"/)
  })
})

describe('parseAssistReply: unknown sections', () => {
  it('refuses rather than returning an empty draft', () => {
    assert.throws(() => parseAssistReply('evidence', 'facts ', {}), /Unknown assist section/)
    assert.throws(() => parseAssistReply('positioning', 'boundaries', {}), /Unknown assist section/)
  })
})

describe('assistMock', () => {
  it('answers every section of every asset with that section\'s demo content', () => {
    for (const asset of Object.keys(ASSIST_SECTIONS) as AssistAsset[]) {
      for (const section of ASSIST_SECTIONS[asset]) {
        const { value, warnings } = assistMock(draft({ asset, section }))
        assert.deepEqual(
          Object.keys(value),
          [...assistSectionKeys(asset, section)],
          `${asset}/${section}`,
        )
        assert.deepEqual(warnings, [ASSIST_MOCK_WARNING], `${asset}/${section}`)
      }
    }
  })

  it('returns the demo brand\'s own words', () => {
    assert.equal(assistMock(draft({ section: 'who' })).value.who, ICP_FIXTURE.who)
    assert.equal(
      assistMock(draft({ asset: 'positioning', section: 'core' })).value.activePosition,
      POSITIONING_FIXTURE.activePosition,
    )
    assert.equal(
      assistMock(draft({ asset: 'workspace', section: 'profile' })).value.companyName,
      'Datum',
    )
  })

  it('obeys the same rules a live reply is held to', () => {
    const pains = assistMock(draft({ section: 'pains' })).value.pains as { confidence: string }[]
    // The fixture states one pain as strong directional; the assistant may not.
    assert.equal(pains.every((row) => row.confidence !== 'strong_directional'), true)
    const claims = assistMock(draft({ asset: 'evidence', section: 'verifiedClaims' })).value
      .verifiedClaims as Record<string, unknown>[]
    assert.equal(claims.length, EVIDENCE_BANK_FIXTURE.verifiedClaims.length)
    assert.equal(
      claims.every((row) => row.ref === '' && row.recheckAt === '' && row.verificationDepth === 'self_reported'),
      true,
    )
  })

  it('merges over the current draft when refining, and replaces it when drafting', () => {
    const current = { who: 'typed by hand', notOurUser: ['kept'] }
    const refined = assistMock(draft({ section: 'who', mode: 'refine', current })).value
    assert.equal(refined.who, ICP_FIXTURE.who)
    assert.deepEqual(refined.notOurUser, ['kept'])

    const drafted = assistMock(draft({ section: 'who', current })).value
    assert.deepEqual(Object.keys(drafted), ['who'])
  })
})
