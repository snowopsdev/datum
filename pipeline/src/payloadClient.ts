import './config'

import { getPayload, type Payload } from 'payload'

export async function initPayload(): Promise<Payload> {
  // Dynamic import so dotenv (loaded by ./config above) runs before
  // cms/src/payload.config.ts reads DATABASE_URL/PAYLOAD_SECRET at module scope.
  const { default: cmsConfig } = await import('../../cms/src/payload.config')
  return getPayload({ config: cmsConfig })
}
