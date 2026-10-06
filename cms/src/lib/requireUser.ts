import config from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

/** Authenticate a server action, preserving its operator-facing wording. */
export async function requireUser(message: string) {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error(message)
  return { payload, user }
}
