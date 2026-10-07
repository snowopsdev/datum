/** Audience-fit labels; Ahrefs remains the source of candidates and opportunity. */
import { createHash } from 'node:crypto'
import { icpToPrompt, type IcpContent } from './icp'
import { positioningToPrompt, emptyPositioningContent, type PositioningContent } from './positioning'
import { workspaceProfileToPrompt, type ResolvedWorkspaceProfile } from './workspaceProfile'
export type TopicFit = 'strong' | 'partial' | 'off'
export interface TopicRelevance {
  keyword: string
  fit: TopicFit
  audienceId: number | string | null
  reason: string
  source: 'model' | 'excluded' | 'unscored'
}
export type RelevanceCandidate = {keyword: string; volume?: number}
const stopwords = new Set('a an and are as at be been but by do does for from has have in into is it its no not of on or our than that the their them these they this those to use users user was we when where which who with without your buyers people readers equipment'.split(' '))
const tokens = (s: string): string[] => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
const distinctive = (s: string): string[] => tokens(s).filter(t => t.length >= 4 && !stopwords.has(t))
const key = (s: string) => s.trim().toLowerCase()
export function notOurUserMatch(keyword: string, icps: IcpContent[], seed = ''): string | null {
  const seedTokens = new Set(tokens(seed)); const words = new Set(tokens(keyword))
  for (const icp of icps) for (const row of icp.notOurUser) {
    if (distinctive(row).some(t => !seedTokens.has(t) && words.has(t))) return row
  }
  return null
}
export function parseTopicRelevance(json: unknown, candidates: RelevanceCandidate[], icps: IcpContent[], seed = ''): TopicRelevance[] {
  const rows = json && typeof json === 'object' && 'candidates' in json && Array.isArray(json.candidates) ? json.candidates : []
  const scored = new Map<string, Record<string, unknown>>()
  for (const raw of rows) if (raw && typeof raw === 'object' && typeof raw.keyword === 'string' && !scored.has(key(raw.keyword))) scored.set(key(raw.keyword), raw)
  return candidates.map(c => {
    const excluded = notOurUserMatch(c.keyword, icps, seed)
    if (excluded) return {keyword:c.keyword,fit:'off',audienceId:null,reason:`Not our user: ${excluded}`,source:'excluded'}
    const row = scored.get(key(c.keyword)); const audience = typeof row?.audience === 'string' ? icps.find(i => key(i.name) === key(row.audience as string)) : null
    if (!row || !['strong','partial','off'].includes(String(row.fit)) || typeof row.reason !== 'string' || !row.reason.trim() || (row.audience != null && !audience)) return {keyword:c.keyword,fit:'partial',audienceId:null,reason:'Not scored',source:'unscored'}
    return {keyword:c.keyword,fit:row.fit as TopicFit,audienceId:audience?.id ?? null,reason:row.reason.trim(),source:'model'}
  })
}
export function mockTopicRelevance(candidates: RelevanceCandidate[], icps: IcpContent[], seed = ''): TopicRelevance[] {
  return parseTopicRelevance({candidates:candidates.map(c => {
    const words = new Set(tokens(c.keyword))
    const icp = icps.find(i => distinctive([i.who,...i.pains.map(p=>p.statement)].join(' ')).some(t=>words.has(t)))
    return {keyword:c.keyword,fit:icp ? 'strong':'partial',audience:icp?.name ?? null,reason:icp ? `Matches ${icp.name}'s needs`:'Some overlap; check the angle'}
  })},candidates,icps,seed)
}
export function rankByFit<T extends {fit?: TopicFit; opportunity: number}>(candidates: T[]): T[] {
  const order = {strong:0,partial:1,off:2}
  return [...candidates].sort((a,b)=>(order[a.fit ?? 'partial']-order[b.fit ?? 'partial']) || b.opportunity-a.opportunity)
}
export function relevanceFingerprint(icps: IcpContent[], positioning: PositioningContent | null, profile: ResolvedWorkspaceProfile): string {
  return createHash('sha256').update(JSON.stringify([icps.map(i=>[i.id,icpToPrompt(i)]),positioningToPrompt(positioning),profile.companyName])).digest('hex')
}
export function buildTopicRelevancePrompt(input: {icps:IcpContent[];positioning:PositioningContent|null;profile:ResolvedWorkspaceProfile;candidates:RelevanceCandidate[]}): {system:string;user:string} {
  return {
    system:'Label each candidate strong, partial, or off for the active audiences. Not our user is the strongest off signal. Choose the best-fitting audience by its exact name, or null. Return JSON only: {"candidates":[{"keyword":string,"fit":"strong"|"partial"|"off","audience":string|null,"reason":string}]}. Give one short reason per keyword. Do not invent candidates.',
    user:[workspaceProfileToPrompt(input.profile),...input.icps.map(i=>icpToPrompt(i)),positioningToPrompt(input.positioning ? {...emptyPositioningContent(), category: input.positioning.category, pillars: input.positioning.pillars} : null),`# Candidates\n${input.candidates.map(c=>`- ${c.keyword} (volume: ${c.volume ?? 0})`).join('\n')}`].filter(Boolean).join('\n\n'),
  }
}
