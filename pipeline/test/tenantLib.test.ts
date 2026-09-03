import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ICP_FIXTURE,
  ICP_FIXTURE_SECONDARY,
  POSITIONING_FIXTURE,
} from '../../cms/src/lib/tenant/fixtures'
import {
  capAssistConfidence,
  emptyIcpContent,
  emptyPositioningContent,
  emptyTenantContext,
  icpAudienceLine,
  icpCompletenessProblems,
  icpsFromDocs,
  MOCK_TARGET_DOMAIN,
  normaliseDomain,
  parseIcpContent,
  parsePositioningContent,
  positioningCompletenessProblems,
  positioningContentOf,
  positioningStatus,
  selectIcp,
  tenantFingerprint,
  parseCompetitorDomainsEnv,
  resolveWorkspaceProfile,
  userAgentFor,
  workspaceProfileProblems,
  workspaceProfileToPrompt,
} from '../../cms/src/lib/tenant'

describe('normaliseDomain', () => {
  it('reduces what an operator actually pastes to a bare host', () => {
    for (const [input, expected] of [
      ['example.com', 'example.com'],
      ['  Example.COM  ', 'example.com'],
      ['https://example.com/pricing?ref=x#top', 'example.com'],
      ['http://example.com', 'example.com'],
      ['example.com:8443', 'example.com'],
      ['example.com.', 'example.com'],
      ['user@example.com', 'example.com'],
      ['sub.example.co.uk', 'sub.example.co.uk'],
    ] as const) {
      assert.equal(normaliseDomain(input), expected, `for ${input}`)
    }
  })

  it('keeps www, because it is a different Ahrefs target', () => {
    assert.equal(normaliseDomain('www.example.com'), 'www.example.com')
  })

  it('refuses anything that is not a host', () => {
    for (const input of [
      '',
      '   ',
      'two words.com',
      'localhost',
      'example',
      '-bad.com',
      'bad-.com',
      'exa mple.com',
      'https://',
      null,
      undefined,
      42,
    ]) {
      assert.equal(normaliseDomain(input), null, `for ${String(input)}`)
    }
  })
})

describe('parseCompetitorDomainsEnv', () => {
  it('names each competitor after its domain', () => {
    assert.deepEqual(parseCompetitorDomainsEnv('a.com, b.com'), [
      { domain: 'a.com', name: 'a.com' },
      { domain: 'b.com', name: 'b.com' },
    ])
  })

  it('drops blanks, duplicates, and unparseable entries', () => {
    assert.deepEqual(parseCompetitorDomainsEnv('a.com,,A.com, not a domain ,https://b.com/x'), [
      { domain: 'a.com', name: 'a.com' },
      { domain: 'b.com', name: 'b.com' },
    ])
  })

  it('answers with an empty list rather than throwing on nothing', () => {
    assert.deepEqual(parseCompetitorDomainsEnv(undefined), [])
    assert.deepEqual(parseCompetitorDomainsEnv(''), [])
  })
})

describe('resolveWorkspaceProfile precedence', () => {
  const env = { TARGET_DOMAIN: 'env.example', COMPETITOR_DOMAINS: 'envrival.example' }

  it('prefers the admin global over the environment', () => {
    const profile = resolveWorkspaceProfile(
      {
        companyName: '  Acme Analytics ',
        targetDomain: 'https://Acme.example/pricing',
        competitors: [{ domain: 'rivalone.com', name: 'Rival One' }, { domain: 'rivaltwo.io' }],
      },
      env,
      { mockDefault: true },
    )

    assert.equal(profile.companyName, 'Acme Analytics')
    assert.equal(profile.targetDomain, 'acme.example')
    assert.deepEqual(profile.competitors, [
      { domain: 'rivalone.com', name: 'Rival One' },
      // An unnamed competitor is called by its domain rather than left blank.
      { domain: 'rivaltwo.io', name: 'rivaltwo.io' },
    ])
    assert.deepEqual(profile.source, { targetDomain: 'admin', competitors: 'admin' })
  })

  it('falls back to the environment per field', () => {
    const profile = resolveWorkspaceProfile({ companyName: 'Acme' }, env, { mockDefault: true })
    assert.equal(profile.targetDomain, 'env.example')
    assert.deepEqual(profile.competitors, [
      { domain: 'envrival.example', name: 'envrival.example' },
    ])
    assert.deepEqual(profile.source, { targetDomain: 'env', competitors: 'env' })
  })

  it('mixes sources: an admin domain with env competitors', () => {
    const profile = resolveWorkspaceProfile({ targetDomain: 'acme.example' }, env)
    assert.equal(profile.targetDomain, 'acme.example')
    assert.deepEqual(profile.source, { targetDomain: 'admin', competitors: 'env' })
  })

  it('falls back again to the demo workspace, but only in mock mode', () => {
    const mock = resolveWorkspaceProfile(null, {}, { mockDefault: true })
    assert.equal(mock.targetDomain, MOCK_TARGET_DOMAIN)
    assert.deepEqual(
      mock.competitors.map((c) => c.domain),
      ['competitor-one.com', 'competitor-two.com'],
    )
    assert.deepEqual(mock.source, { targetDomain: 'default', competitors: 'default' })

    // A live run gets nothing rather than quietly researching a fake domain.
    const live = resolveWorkspaceProfile(null, {})
    assert.equal(live.targetDomain, null)
    assert.deepEqual(live.competitors, [])
    assert.deepEqual(live.source, { targetDomain: 'default', competitors: 'default' })
  })

  it('ignores admin values that are not hosts, so a typo falls through to env', () => {
    const profile = resolveWorkspaceProfile(
      { targetDomain: 'not a domain', competitors: [{ domain: '' }] },
      env,
    )
    assert.equal(profile.targetDomain, 'env.example')
    assert.deepEqual(profile.source, { targetDomain: 'env', competitors: 'env' })
  })

  it('normalises a never-saved global into an empty profile', () => {
    const profile = resolveWorkspaceProfile({}, {})
    assert.equal(profile.companyName, '')
    assert.equal(profile.siteNotes, '')
    assert.deepEqual(profile.sitePages, [])
    assert.deepEqual(profile.competitors, [])
  })

  it('keeps only site pages that carry a url', () => {
    const profile = resolveWorkspaceProfile(
      {
        sitePages: [
          { url: 'https://acme.example/', title: 'Home', text: 'hi', fetchedAt: '2026-09-01' },
          { title: 'No url' },
          'nonsense',
        ],
      },
      {},
    )
    assert.deepEqual(profile.sitePages, [
      { url: 'https://acme.example/', title: 'Home', text: 'hi', fetchedAt: '2026-09-01' },
    ])
  })
})

describe('workspaceProfileProblems', () => {
  it('names what is missing, and says nothing when nothing is', () => {
    assert.deepEqual(workspaceProfileProblems(resolveWorkspaceProfile(null, {})), [
      'Set the target domain',
      'Add at least one competitor',
    ])
    assert.deepEqual(
      workspaceProfileProblems(resolveWorkspaceProfile(null, {}, { mockDefault: true })),
      [],
    )
  })
})

describe('workspaceProfileToPrompt', () => {
  it('renders the workspace block', () => {
    const profile = resolveWorkspaceProfile(
      {
        companyName: 'Acme Analytics',
        targetDomain: 'acme.example',
        competitors: [{ domain: 'rivalone.com', name: 'Rival One' }, { domain: 'rivaltwo.io' }],
      },
      {},
    )
    assert.equal(
      workspaceProfileToPrompt(profile),
      [
        '# Workspace',
        'Company: Acme Analytics (acme.example)',
        'Competitors named in this workspace: Rival One (rivalone.com), rivaltwo.io',
        'Treat any statement about Acme Analytics, its product, customers, pricing, results, or ' +
          'measurements as a first-party claim governed by the Evidence bank.',
      ].join('\n'),
    )
  })

  it('omits sections it has nothing for', () => {
    const domainOnly = workspaceProfileToPrompt(
      resolveWorkspaceProfile({ targetDomain: 'acme.example' }, {}),
    )
    assert.match(domainOnly, /Company site: acme\.example/)
    assert.ok(!domainOnly.includes('Competitors named'))
    assert.match(domainOnly, /statement about acme\.example/)

    // Nothing known at all renders nothing, not a bare heading.
    assert.equal(workspaceProfileToPrompt(resolveWorkspaceProfile(null, {})), '')
  })

  it('renders the same string twice, so a prompt snapshot is comparable', () => {
    const profile = resolveWorkspaceProfile({ companyName: 'Acme', targetDomain: 'a.com' }, {})
    assert.equal(workspaceProfileToPrompt(profile), workspaceProfileToPrompt(profile))
  })
})

describe('userAgentFor', () => {
  it('carries a contact url when there is a domain to name', () => {
    assert.equal(userAgentFor('acme.example'), 'DatumBot/1.0 (+https://acme.example)')
  })

  it('never dangles an empty url', () => {
    for (const domain of [null, undefined, '']) {
      assert.equal(userAgentFor(domain), 'DatumBot/1.0')
    }
  })
})

// ---------------------------------------------------------------------------
// ICPs
// ---------------------------------------------------------------------------

describe('parseIcpContent', () => {
  it('turns a Payload document into clean content', () => {
    const { content, warnings } = parseIcpContent({
      id: 4,
      name: '  Growth marketer  ',
      status: 'active',
      primary: true,
      who: ' Owns the blog ',
      pains: [
        {
          statement: ' Briefs take a day ',
          evidence: [{ ref: '12 interviews', note: 'Q2' }, { ref: '', note: '' }],
          confidence: 'strong_directional',
        },
      ],
      motivation: { text: ' Ship more ', hypothesis: true, confidence: 'hypothesis' },
      solution: {
        mechanism: ' One governed pipeline ',
        sampleLines: [{ text: 'A brief before a draft' }, { text: '  ' }],
        confidence: 'verified',
      },
      competition: [{ competitor: 'Rival One', claim: 'AI writes it all', confidence: 'verified' }],
      whyUs: { text: 'Sourced claims', confidence: 'strong_directional' },
      channels: [{ channel: 'LinkedIn', note: 'founder posts', confidence: 'cultural_signal' }],
      churnTriggers: [{ text: 'Heavy edits' }],
      notOurUser: [{ text: 'Solo bloggers' }],
    })

    assert.equal(content.id, 4)
    assert.equal(content.name, 'Growth marketer')
    assert.equal(content.status, 'active')
    assert.equal(content.primary, true)
    assert.equal(content.who, 'Owns the blog')
    assert.equal(content.pains[0]!.statement, 'Briefs take a day')
    // The blank evidence row carries neither a ref nor a note, so it is dropped.
    assert.deepEqual(content.pains[0]!.evidence, [{ ref: '12 interviews', note: 'Q2' }])
    assert.deepEqual(content.solution.sampleLines, ['A brief before a draft'])
    assert.deepEqual(content.churnTriggers, ['Heavy edits'])
    assert.deepEqual(content.notOurUser, ['Solo bloggers'])
    assert.deepEqual(warnings, [])
  })

  it('never throws on garbage, and says what it could not use', () => {
    assert.deepEqual(parseIcpContent(null).content, emptyIcpContent())
    assert.deepEqual(parseIcpContent('nope').content, emptyIcpContent())
    assert.equal(parseIcpContent({ pains: 'x', competition: 7 }).content.pains.length, 0)
    // An unrecognised status is a draft, not an error: a half-written row must
    // never be treated as one that governs a run.
    assert.equal(parseIcpContent({ status: 'live' }).content.status, 'draft')

    const { content, warnings } = parseIcpContent({
      pains: [{ statement: 'x', confidence: 'very_sure' }, { evidence: [{ ref: 'a' }] }],
      competition: [{ claim: 'orphaned' }],
    })
    assert.equal(content.pains.length, 1)
    assert.equal(content.pains[0]!.confidence, null)
    assert.equal(content.competition.length, 0)
    assert.equal(warnings.length, 3)
    assert.match(warnings.join('\n'), /very_sure/)
    assert.match(warnings.join('\n'), /no statement/)
    assert.match(warnings.join('\n'), /no competitor/)
  })
})

describe('icpCompletenessProblems', () => {
  it('names the four things an audience cannot be activated without', () => {
    assert.deepEqual(icpCompletenessProblems(emptyIcpContent()), [
      'Give the audience a name',
      'Describe who they are in one line',
      'Add at least one pain statement',
      'Say how we solve it (the mechanism)',
    ])
  })

  it('passes the fixtures, which is what makes the demo workspace activatable', () => {
    assert.deepEqual(icpCompletenessProblems(ICP_FIXTURE), [])
    assert.deepEqual(icpCompletenessProblems(ICP_FIXTURE_SECONDARY), [])
  })
})

describe('icpAudienceLine', () => {
  it('is the who plus the first pain, as one sentence', () => {
    assert.equal(
      icpAudienceLine({
        ...emptyIcpContent('x'),
        who: 'A marketing lead at a small B2B company',
        pains: [
          { statement: 'Briefs take a day', evidence: [], confidence: null },
          { statement: 'Cannot prove impact', evidence: [], confidence: null },
        ],
      }),
      'A marketing lead at a small B2B company. Main pain: Briefs take a day.',
    )
  })

  it('does not double a full stop the operator already typed', () => {
    assert.equal(
      icpAudienceLine({
        ...emptyIcpContent('x'),
        who: 'A founder.',
        pains: [{ statement: 'No time.', evidence: [], confidence: null }],
      }),
      'A founder. Main pain: No time.',
    )
  })

  it('renders whichever half exists, and nothing for an empty audience', () => {
    assert.equal(icpAudienceLine({ ...emptyIcpContent('x'), who: 'A founder' }), 'A founder')
    assert.equal(
      icpAudienceLine({
        ...emptyIcpContent('x'),
        pains: [{ statement: 'No time', evidence: [], confidence: null }],
      }),
      'Main pain: No time.',
    )
    assert.equal(icpAudienceLine(emptyIcpContent('x')), '')
    assert.equal(icpAudienceLine(null), '')
  })
})

describe('capAssistConfidence', () => {
  it('drops every asserted level to inference, and leaves the rest alone', () => {
    const capped = capAssistConfidence(ICP_FIXTURE)
    assert.equal(capped.pains[0]!.confidence, 'inference') // was strong_directional
    assert.equal(capped.pains[1]!.confidence, 'qualitative_pattern') // untouched
    assert.equal(capped.solution.confidence, 'inference') // was verified
    assert.equal(capped.competition[0]!.confidence, 'inference') // was verified
    assert.equal(capped.competition[1]!.confidence, 'inference') // already inference
    assert.equal(capped.whyUs.confidence, 'inference') // was strong_directional
    assert.equal(capped.motivation.confidence, 'hypothesis') // untouched
    assert.equal(capped.channels[1]!.confidence, 'cultural_signal') // untouched
    // Nothing else moves: only the confidences are rewritten.
    assert.equal(capped.name, ICP_FIXTURE.name)
    assert.deepEqual(capped.solution.sampleLines, ICP_FIXTURE.solution.sampleLines)
  })
})

// ---------------------------------------------------------------------------
// Tenant context
// ---------------------------------------------------------------------------

const icp = (id: number, name: string, primary = false) => ({
  ...emptyIcpContent(name),
  id,
  status: 'active' as const,
  primary,
})

const tenantWith = (icps: ReturnType<typeof icp>[]) => ({ ...emptyTenantContext(), icps })

describe('selectIcp', () => {
  const primary = icp(1, 'Primary', true)
  const other = icp(2, 'Other')
  const tenant = tenantWith([primary, other])

  it('uses the article’s own audience, by id or populated document', () => {
    assert.equal(selectIcp(tenant, { icp: 2 }), other)
    assert.equal(selectIcp(tenant, { icp: { id: 2 } }), other)
    // Payload ids are numbers here and strings elsewhere; both must match.
    assert.equal(selectIcp(tenant, { icp: '2' }), other)
  })

  it('falls back to the primary when the article points at nothing usable', () => {
    assert.equal(selectIcp(tenant, {}), primary)
    assert.equal(selectIcp(tenant, { icp: null }), primary)
    assert.equal(selectIcp(tenant, null), primary)
    // An audience that has since been archived is not in `icps` at all, and
    // writing for an archived reader is worse than writing for the primary.
    assert.equal(selectIcp(tenant, { icp: 99 }), primary)
  })

  it('falls back to the first when nothing is primary, and to null when there is nothing', () => {
    assert.equal(selectIcp(tenantWith([other]), {}), other)
    assert.equal(selectIcp(emptyTenantContext(), { icp: 2 }), null)
  })
})

describe('icpsFromDocs', () => {
  it('puts the primary first and orders the rest by name', () => {
    const ordered = icpsFromDocs([
      { id: 3, name: 'Zoe', status: 'active' },
      { id: 1, name: 'Primary', status: 'active', primary: true },
      { id: 2, name: 'Ada', status: 'active' },
    ])
    assert.deepEqual(
      ordered.map((row) => row.name),
      ['Primary', 'Ada', 'Zoe'],
    )
  })
})

describe('tenantFingerprint', () => {
  const profile = resolveWorkspaceProfile({ targetDomain: 'acme.example' }, {})
  const icps = [{ id: 1, updatedAt: '2026-01-01T00:00:00.000Z', primary: true }]

  it('is stable across calls and independent of the order rows arrive in', () => {
    const second = { id: 2, updatedAt: '2026-01-02T00:00:00.000Z', primary: false }
    assert.equal(
      tenantFingerprint({ profile, icps: [...icps, second] }),
      tenantFingerprint({ profile, icps: [second, ...icps] }),
    )
  })

  it('moves when an audience is edited, added, or loses the primary flag', () => {
    const base = tenantFingerprint({ profile, icps })
    assert.notEqual(
      base,
      tenantFingerprint({ profile, icps: [{ ...icps[0]!, updatedAt: '2026-02-01T00:00:00.000Z' }] }),
    )
    assert.notEqual(
      base,
      tenantFingerprint({ profile, icps: [...icps, { id: 2, updatedAt: 'x', primary: false }] }),
    )
    assert.notEqual(base, tenantFingerprint({ profile, icps: [{ ...icps[0]!, primary: false }] }))
    assert.notEqual(base, tenantFingerprint({ profile, icps: [] }))
  })

  it('moves when the workspace itself changes', () => {
    assert.notEqual(
      tenantFingerprint({ profile, icps }),
      tenantFingerprint({ profile: resolveWorkspaceProfile({ targetDomain: 'other.example' }, {}), icps }),
    )
  })
})

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

describe('parsePositioningContent', () => {
  it('turns a Payload document into clean content', () => {
    const { content, warnings } = parsePositioningContent({
      category: '  governed content pipeline  ',
      goal: 'be the default',
      coreClaims: [
        { claim: ' Sourced or labelled ', evidenceRef: '[e4]' },
        { claim: 'Approved before spend', evidenceRef: '' },
      ],
      pillars: [{ name: 'Governance', oneLine: 'One gate', carries: 'trust' }],
      descriptorLadder: [{ descriptor: 'software', note: 'for a stranger' }],
      vocabularyReachFor: [{ term: 'sourced', note: '' }],
      vocabularyAvoid: [{ term: 'autopilot', note: 'the enemy' }],
      openRulings: [
        { question: 'Are we a CMS?', status: 'open', ruling: '', ruledAt: '' },
        { question: 'Do we say platform?', status: 'ruled', ruling: 'No', ruledAt: '2026-05-01' },
      ],
    })
    assert.deepEqual(warnings, [])
    assert.equal(content.category, 'governed content pipeline')
    assert.equal(content.goal, 'be the default')
    // Brackets and case are stripped: the bank stores `E4`, not `[e4]`.
    assert.deepEqual(content.coreClaims, [
      { claim: 'Sourced or labelled', evidenceRef: 'E4' },
      { claim: 'Approved before spend', evidenceRef: '' },
    ])
    assert.deepEqual(content.pillars, [
      { name: 'Governance', oneLine: 'One gate', carries: 'trust' },
    ])
    assert.deepEqual(content.descriptorLadder, [
      { descriptor: 'software', note: 'for a stranger' },
    ])
    assert.equal(content.openRulings.length, 2)
    assert.equal(content.openRulings[1]!.status, 'ruled')
    // Everything unsaid comes back as an empty string, never undefined.
    assert.equal(content.enemy, '')
    assert.equal(content.essence, '')
  })

  it('never throws on garbage, and says what it could not use', () => {
    const { content, warnings } = parsePositioningContent({
      category: 42,
      coreClaims: [{ claim: '', evidenceRef: 'E1' }, 'nope'],
      pillars: [{ oneLine: 'orphaned', carries: 'nothing' }],
      vocabularyAvoid: [{ note: 'why', term: '   ' }],
      openRulings: [{ ruling: 'settled', status: 'bogus' }],
      descriptorLadder: 'not an array',
    })
    assert.equal(content.category, '')
    assert.deepEqual(content.coreClaims, [])
    assert.deepEqual(content.pillars, [])
    assert.deepEqual(content.descriptorLadder, [])
    assert.deepEqual(warnings, [
      'Dropped a core claim with an evidence ref but no claim',
      'Dropped a pillar with no name',
      'Dropped an avoid vocabulary entry with a note but no term',
      'Dropped a ruling with no question',
    ])
  })

  it('reads a never-saved global as empty rather than throwing', () => {
    assert.deepEqual(positioningContentOf(null), emptyPositioningContent())
    assert.deepEqual(positioningContentOf(undefined), emptyPositioningContent())
    assert.deepEqual(positioningContentOf('nonsense'), emptyPositioningContent())
  })

  it('defaults an unreadable ruling status to open, which is the safe answer', () => {
    // Treating an unknown status as "ruled" would silently drop the question
    // from the prompt, and the writer would take a position nobody agreed.
    const { content } = parsePositioningContent({
      openRulings: [{ question: 'Are we a CMS?', status: 'whatever' }],
    })
    assert.equal(content.openRulings[0]!.status, 'open')
  })
})

describe('positioningCompletenessProblems', () => {
  it('names the seven things a finished position needs', () => {
    assert.deepEqual(positioningCompletenessProblems(emptyPositioningContent()), [
      'Name the category',
      'State the one goal',
      'Write the customer promise',
      'Name the position to own',
      'Write the positioning statement',
      'Write exactly three core claims (there are 0)',
      'Add at least one pillar',
    ])
  })

  it('rejects two claims and four claims alike, because three is the discipline', () => {
    const claim = (claim: string) => ({ claim, evidenceRef: '' })
    const base = { ...POSITIONING_FIXTURE }
    assert.deepEqual(positioningCompletenessProblems(base), [])
    assert.deepEqual(
      positioningCompletenessProblems({ ...base, coreClaims: [claim('a'), claim('b')] }),
      ['Write exactly three core claims (there are 2)'],
    )
    assert.deepEqual(
      positioningCompletenessProblems({
        ...base,
        coreClaims: [claim('a'), claim('b'), claim('c'), claim('d')],
      }),
      ['Write exactly three core claims (there are 4)'],
    )
    assert.deepEqual(positioningCompletenessProblems({ ...base, coreClaims: [claim('a')] }), [
      'Write exactly three core claims (there is 1)',
    ])
  })

  it('passes the fixture, which is what makes the demo workspace a worked example', () => {
    assert.deepEqual(positioningCompletenessProblems(POSITIONING_FIXTURE), [])
  })
})

describe('positioningStatus', () => {
  it('is missing only when nothing at all has been saved', () => {
    assert.equal(positioningStatus(null), 'missing')
    assert.equal(positioningStatus(undefined), 'missing')
    assert.equal(positioningStatus(emptyPositioningContent()), 'missing')
  })

  it('is partial for anything saved but unfinished, whichever field it was', () => {
    assert.equal(
      positioningStatus({ ...emptyPositioningContent(), category: 'analytics' }),
      'partial',
    )
    // Even a field that completeness never asks about counts as saved: the
    // question here is "has anybody worked on this", not "is it correct".
    assert.equal(
      positioningStatus({ ...emptyPositioningContent(), essence: 'calm certainty' }),
      'partial',
    )
    assert.equal(
      positioningStatus({
        ...emptyPositioningContent(),
        openRulings: [{ question: 'Are we a CMS?', status: 'open', ruling: '', ruledAt: '' }],
      }),
      'partial',
    )
    assert.equal(positioningStatus({ ...POSITIONING_FIXTURE, pillars: [] }), 'partial')
  })

  it('is ready when completeness has nothing left to say', () => {
    assert.equal(positioningStatus(POSITIONING_FIXTURE), 'ready')
  })
})

describe('tenantFingerprint (positioning)', () => {
  const profile = resolveWorkspaceProfile({ targetDomain: 'acme.example' }, {})
  const icps = [{ id: 1, updatedAt: '2026-01-01T00:00:00.000Z', primary: true }]

  it('moves when the position is saved or edited', () => {
    const none = tenantFingerprint({ profile, icps })
    const saved = tenantFingerprint({
      profile,
      icps,
      positioningUpdatedAt: '2026-02-01T00:00:00.000Z',
    })
    assert.notEqual(none, saved)
    assert.notEqual(
      saved,
      tenantFingerprint({ profile, icps, positioningUpdatedAt: '2026-02-02T00:00:00.000Z' }),
    )
  })

  it('treats an absent timestamp and an explicit null as the same workspace', () => {
    assert.equal(
      tenantFingerprint({ profile, icps }),
      tenantFingerprint({ profile, icps, positioningUpdatedAt: null }),
    )
  })
})
