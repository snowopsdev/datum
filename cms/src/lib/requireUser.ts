import config from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

/** The caller, or `user: null` when nobody is signed in. For actions that have a signed-out answer. */
export async function optionalUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  return { payload, user }
}

/** Authenticate a server action, preserving its operator-facing wording. */
export async function requireUser(message: string) {
  const { payload, user } = await optionalUser()
  if (!user) throw new Error(message)
  return { payload, user }
}
