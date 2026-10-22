/**
 * The pure half of `useDirtyGuard`: what counts as unsaved, the local copy an
 * unsaved edit is mirrored to, whether that copy may be put back, and which
 * clicks the leave guard stops.
 *
 * No React and no globals read at import time, so each rule can be tested
 * against a plain object. Storage and the click's origin are passed in; the
 * hook supplies the real ones.
 */

import { stableStringify } from '../../lib/tenant/evidenceBankDiff'

/** How long an unsaved edit is kept in the browser. */
export const LOCAL_COPY_TTL_MS = 24 * 60 * 60 * 1000
/** How long to wait after the last keystroke before mirroring the edit. */
export const LOCAL_WRITE_DEBOUNCE_MS = 500

const KEY_PREFIX = 'datum:draft:'

/** `savedAt` is the server version (`updatedAt`) the edit was made on top of. */
export type LocalCopy<T> = { value: T; savedAt: string | null; at: number }

/** Equal by value, whatever order an object's keys were built in. */
export const sameValue = (a: unknown, b: unknown): boolean =>
  stableStringify(a) === stableStringify(b)

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** Top-level keys whose value differs from the snapshot. */
export function changedKeys(value: unknown, snapshot: unknown): string[] {
  const now = asRecord(value)
  const was = asRecord(snapshot)
  const keys = new Set([...Object.keys(now), ...Object.keys(was)])
  return [...keys].filter((key) => !sameValue(now[key], was[key])).sort()
}

export type CountChanges<T> = (value: T, snapshot: T) => number

/**
 * How many changes are unsaved. An editor that has its own idea of a change
 * (the evidence bank counts rows, and ignores a blank one) passes
 * `countChanges`; it then also decides whether anything is dirty at all, so a
 * click on "Add a claim" does not light up "0 unsaved changes".
 */
export function changeCountOf<T>(value: T, snapshot: T, countChanges?: CountChanges<T>): number {
  if (countChanges) return Math.max(0, countChanges(value, snapshot))
  return changedKeys(value, snapshot).length
}

export const storageKey = (formKey: string) => `${KEY_PREFIX}${formKey}`

/** The browser's localStorage, or null where there is none or it throws on access. */
export function browserStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null

export function clearLocalCopy(formKey: string, storage: Store = browserStorage()): void {
  try {
    storage?.removeItem(storageKey(formKey))
  } catch {
    // Private mode and a full quota both land here; there is nothing to clear.
  }
}

/** Never throws: a missing, corrupt, malformed or expired copy is no copy. */
export function readLocalCopy<T>(
  formKey: string,
  now: number = Date.now(),
  storage: Store = browserStorage(),
): LocalCopy<T> | null {
  try {
    const raw = storage?.getItem(storageKey(formKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocalCopy<T>> | null
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.at !== 'number' ||
      !('value' in parsed)
    ) {
      return null
    }
    if (now - parsed.at > LOCAL_COPY_TTL_MS || parsed.at > now + 60_000) {
      clearLocalCopy(formKey, storage)
      return null
    }
    return {
      value: parsed.value as T,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
      at: parsed.at,
    }
  } catch {
    return null
  }
}

export function writeLocalCopy<T>(
  formKey: string,
  copy: LocalCopy<T>,
  storage: Store = browserStorage(),
): void {
  try {
    storage?.setItem(storageKey(formKey), JSON.stringify(copy))
  } catch {
    // Quota or private mode: the edit is simply not mirrored.
  }
}

/**
 * What to do with a local copy found on load.
 *
 * - `apply`: the copy differs from the server and was made on top of the
 *   version the server still has, so it is the person's own unsaved edit.
 * - `ask`: the record was saved by someone else since, so putting the copy
 *   back would silently overwrite their work.
 * - `none`: nothing to restore (no copy, or it matches what is saved).
 */
export function restoreDecision<T>(
  copy: LocalCopy<T> | null,
  snapshot: T,
  version: string | null,
): 'none' | 'apply' | 'ask' {
  if (!copy || sameValue(copy.value, snapshot)) return 'none'
  return copy.savedAt === version ? 'apply' : 'ask'
}

/** "2 minutes ago", for the restore banner. */
export function agoLabel(at: number, now: number = Date.now()): string {
  const minutes = Math.max(1, Math.round((now - at) / 60_000))
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

export function savedTimeLabel(at: Date): string {
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export const unsavedLabel = (count: number) => `${count} unsaved change${count === 1 ? '' : 's'}`

/**
 * The text on a Save button, from what is actually true of the form.
 * `withCount` is for the bar, where the number is the point; the button beside
 * the form stays "Save" so the two are never the same name.
 */
export function saveLabel(
  state: { dirty: boolean; changeCount: number; saving: boolean; savedAt: Date | null },
  withCount = false,
): string {
  if (state.saving) return 'Saving…'
  if (state.dirty) {
    return withCount
      ? `Save ${state.changeCount} change${state.changeCount === 1 ? '' : 's'}`
      : 'Save'
  }
  return state.savedAt ? `Saved · ${savedTimeLabel(state.savedAt)}` : 'Save'
}

/** "the outline, rules and 2 more", for the leave dialog. */
export function describeChanged(keys: string[], labels: Record<string, string> = {}): string {
  const names = keys.map((key) => labels[key] ?? key)
  if (names.length === 0) return 'this form'
  if (names.length <= 3) {
    return names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

type ClickLike = Pick<
  MouseEvent,
  'altKey' | 'button' | 'ctrlKey' | 'defaultPrevented' | 'metaKey' | 'shiftKey' | 'target'
>

/**
 * The anchor this click would navigate away through, or null when the click
 * is not a navigation the guard should stop: a modified click (new tab, new
 * window, save-as), a `target` other than this window, a download, another
 * origin (the browser's own `beforeunload` prompt covers a hard leave), or a
 * link that only moves within the page.
 */
export function guardedAnchor(
  event: ClickLike,
  here: { href: string; origin: string },
): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const target = event.target
  if (!target || typeof (target as Element).closest !== 'function') return null
  const anchor = (target as Element).closest('a[href]') as HTMLAnchorElement | null
  if (!anchor) return null
  const frame = anchor.getAttribute('target')
  if (frame && frame !== '_self') return null
  if (anchor.hasAttribute('download')) return null
  let url: URL
  try {
    url = new URL(anchor.href, here.href)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.origin !== here.origin) return null
  const current = new URL(here.href)
  const samePage = url.pathname === current.pathname && url.search === current.search
  if (samePage && (url.hash !== '' || url.href === current.href)) return null
  return anchor
}
