import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { CmsLlmError, cmsMockMode, completeJsonCms, logCmsCost } from './cmsLlm'
import { buildTopicRelevancePrompt, mockTopicRelevance, parseTopicRelevance, type RelevanceCandidate } from './tenant/topicRelevance'
import type { loadTenantContextCms } from './loadTenantContextCms'
export async function scoreTopicRelevance(payload:Payload, candidates:RelevanceCandidate[], tenant:Awaited<ReturnType<typeof loadTenantContextCms>>, seed:string, model:string) {
  const runId=`topic-relevance:${randomUUID()}`
  const request=buildTopicRelevancePrompt({...tenant,candidates})
  if (cmsMockMode(process.env,model)) {
    const relevance=mockTopicRelevance(candidates,tenant.icps,seed)
    await logCmsCost(payload,{runId,stage:'topicRelevance',provider:'mock',model,usage:{inputTokens:0,outputTokens:0},request,response:{candidates:relevance}})
    return relevance
  }
  let result
  try {result=await completeJsonCms({...request,model,label:'Topic relevance'})}
  catch (e) {
    if (e instanceof CmsLlmError) await logCmsCost(payload,{runId,stage:'topicRelevance',...e.billed,request,response:{error:'reply unusable'}})
    throw e
  }
  await logCmsCost(payload,{runId,stage:'topicRelevance',...result,request,response:JSON.parse(JSON.stringify(result.json))})
  return parseTopicRelevance(result.json,candidates,tenant.icps,seed)
}
