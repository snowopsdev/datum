/**
 * Where status-change webhooks go. Resolved the same way models are
 * (`llmSettings.ts`): the admin global wins per field, then the env override,
 * then disabled. Deliveries are signed, so an endpoint without a secret is
 * treated as unconfigured rather than called unsigned.
 */

export const WEBHOOK_URL_ENV_VAR = 'WEBHOOK_URL'
export const WEBHOOK_SECRET_ENV_VAR = 'WEBHOOK_SECRET'

/** Shape of the `webhook-settings` global (blank means "use env/default"). */
export interface WebhookSettingsDoc {
  url?: string | null
  secret?: string | null
  enabled?: boolean | null
}

export type WebhookSource = 'admin' | 'env' | 'default'

export interface ResolvedWebhookSettings {
  url: string | null
  secret: string | null
  /** True only when a url and a secret both resolved and the admin kill switch is not off. */
  enabled: boolean
  source: WebhookSource
}

const clean = (value: string | null | undefined): string | undefined => value?.trim() || undefined

export function resolveWebhookSettings(
  settings: WebhookSettingsDoc | null | undefined,
  env: Record<string, string | undefined>,
): ResolvedWebhookSettings {
  const adminUrl = clean(settings?.url)
  const adminSecret = clean(settings?.secret)
  const url = adminUrl ?? clean(env[WEBHOOK_URL_ENV_VAR]) ?? null
  const secret = adminSecret ?? clean(env[WEBHOOK_SECRET_ENV_VAR]) ?? null
  const source: WebhookSource =
    adminUrl || adminSecret ? 'admin' : url || secret ? 'env' : 'default'
  // `enabled === false` is an explicit kill switch; unset (no global saved yet)
  // must not block an env-only setup, so only a literal false disables.
  const killed = settings?.enabled === false
  return { url, secret, enabled: !killed && Boolean(url && secret), source }
}
