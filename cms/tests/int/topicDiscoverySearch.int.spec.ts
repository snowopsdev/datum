import {randomUUID} from 'node:crypto'
import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest'
import {getPayload,type Payload} from 'payload'
import config from '@/payload.config'
import {emptyTenantContext} from '@/lib/tenant'
import {ICP_FIXTURE} from '@/lib/tenant/fixtures'
import type {IcpContent} from '@/lib/tenant/icp'

let payload:Payload
let seed:string
let tenant:ReturnType<typeof emptyTenantContext>
const discover=vi.fn(async()=>[
  {keyword:'espresso wholesale',volume:1000,difficulty:1,opportunity:1000},
  {keyword:'espresso grinder',volume:10,difficulty:2,opportunity:5},
])
vi.mock('@/lib/requireUser',()=>({requireUser:async()=>({payload,user:{id:1,email:'discovery@example.com',role:'admin'}})}))
vi.mock('@/lib/loadTenantContextCms',()=>({loadTenantContextCms:async()=>tenant}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('../../../pipeline/src/ahrefs',()=>({createAhrefsClient:()=>({discoverKeywords:discover})}))
const {discoverTopicsAction}=await import('@/components/ops/topicDiscoveryActions')
beforeAll(async()=>{payload=await getPayload({config:await config})})
beforeEach(()=>{seed=`espresso ${randomUUID()}`;tenant={...emptyTenantContext(),icps:[{...ICP_FIXTURE,id:101}]};discover.mockClear()})
afterAll(async()=>{await payload.delete({collection:'topic-searches',where:{seed:{contains:'espresso '}},overrideAccess:true})})
const costs=async()=> (await payload.find({collection:'cost-log',where:{stage:{equals:'topicRelevance'}},limit:0,overrideAccess:true})).totalDocs
it('mock scores and ranks by fit, and a fresh cache spends no calls',async()=>{
  const before=await costs(); const first=await discoverTopicsAction(seed)
  expect(first.ok).toBe(true)
  if(!first.ok)return
  expect(first.candidates.map(c=>[c.keyword,c.fit])).toEqual([['espresso grinder','strong'],['espresso wholesale','off']])
  expect(await costs()).toBe(before+1)
  const second=await discoverTopicsAction(seed)
  expect(second.ok && second.cached).toBe(true)
  expect(discover).toHaveBeenCalledTimes(1);expect(await costs()).toBe(before+1)
})
it('audience content edits re-score cached metrics without calling Ahrefs',async()=>{
  await discoverTopicsAction(seed);const before=await costs()
  tenant.icps=tenant.icps.map(i=>({...i,pains:[{statement:'New needs',confidence:null,evidence:[]}]})) as IcpContent[]
  const result=await discoverTopicsAction(seed)
  expect(result.ok && result.cached).toBe(true)
  expect(discover).toHaveBeenCalledTimes(1);expect(await costs()).toBe(before+1)
})
it('no active audience skips scoring and preserves opportunity order',async()=>{
  tenant.icps=[];const before=await costs();const result=await discoverTopicsAction(seed)
  expect(result.ok).toBe(true)
  if(!result.ok)return
  expect(result.candidates.map(c=>c.fit)).toEqual([undefined,undefined])
  expect(result.candidates[0].keyword).toBe('espresso wholesale');expect(await costs()).toBe(before)
})
it('refresh fetches and scores both, and malformed cache metrics trigger a new fetch',async()=>{
  await discoverTopicsAction(seed);const before=await costs()
  await discoverTopicsAction(seed,{refresh:true})
  expect(discover).toHaveBeenCalledTimes(2);expect(await costs()).toBe(before+1)
  const cache=await payload.find({collection:'topic-searches',where:{seed:{equals:seed}},limit:1,overrideAccess:true})
  await payload.update({collection:'topic-searches',id:cache.docs[0].id,data:{candidates:[{keyword:'bad'}]},overrideAccess:true})
  await discoverTopicsAction(seed);expect(discover).toHaveBeenCalledTimes(3)
})
