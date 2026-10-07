import type { Payload } from 'payload'
import { icpsFromDocs, positioningContentOf, resolveWorkspaceProfile } from './tenant'
/** Full audience content for discovery. Setup assist keeps its richer loader. */
export async function loadTenantContextCms(payload: Payload, mode: 'mock' | 'live') {
  const [profileDoc, icps, positioningDoc] = await Promise.all([
    payload.findGlobal({slug:'workspace-profile',depth:0,overrideAccess:true}),
    payload.find({collection:'icps',where:{status:{equals:'active'}},sort:['-primary','name'],pagination:false,depth:0,overrideAccess:true}),
    payload.findGlobal({slug:'positioning',depth:0,overrideAccess:true}),
  ])
  return {profile:resolveWorkspaceProfile(profileDoc,process.env,{mockDefault:mode === 'mock'}),icps:icpsFromDocs(icps.docs),positioning:positioningContentOf(positioningDoc)}
}
