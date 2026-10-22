'use client'

import { useAuth } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'

import {
  changeCountOf,
  changedKeys,
  type CountChanges,
  clearLocalCopy,
  guardedAnchor,
  LOCAL_WRITE_DEBOUNCE_MS,
  ownedKey,
  readLocalCopy,
  restoreDecision,
  sameValue,
  writeLocalCopy,
} from './dirtyGuardCore'

/** What a successful save hands back so the hook can take it as the new baseline. */
export type SavedResult<T> = {
  /** The form as the server now holds it. Anything left different stays unsaved. */
  saved: T
  /** The record's new `updatedAt`, when the save knows it. Else the next page load supplies it. */
  version?: string | null
  /** Set when the save changed which record this form is (a create gets its id). */
  key?: string
}

export type DirtyGuardOptions<T> = {
  /** One per record: `template:12`, `evidence`, `icp:new`. Storage and restore are keyed on it. */
  formKey: string
  /** The form as it is now. */
  value: T
  /** The saved form for this key; read on mount and whenever `formKey` changes. */
  initial: T
  /** The record's `updatedAt`, so a copy made on an older version is not put back over a newer one. */
  version?: string | null
  /** Put a whole form value back into the editor's state. */
  onReset: (value: T) => void
  /** The editor's own count of changes; it also decides whether the form is dirty at all. */
  countChanges?: CountChanges<T>
  /** Human names for top-level keys, for the leave dialog. */
  labels?: Record<string, string>
  /** Save; null means it failed and has already said why. Needed for "Save and leave". */
  save?: (baseline: T) => Promise<SavedResult<T> | null>
}

export type RestoreState<T> =
  | { kind: 'restored'; at: number }
  | { kind: 'stale'; at: number; value: T }

export type LeaveRequest = {
  proceed: () => void
  opener: HTMLElement | null
}

export type DirtyGuard<T> = {
  dirty: boolean
  /** The form as last saved. */
  saved: T
  changeCount: number
  /** Top-level fields that differ from what is saved. */
  changed: string[]
  labels: Record<string, string>
  savedAt: Date | null
  saving: boolean
  /** Run the editor's save and take its result as the new baseline. */
  submit: () => Promise<boolean>
  markSaved: (next: T, extra?: { version?: string | null; key?: string }) => void
  discard: () => void
  restore: RestoreState<T> | null
  /** Keep the older local edit over the newer saved record. */
  keepMine: () => void
  dismissRestore: () => void
  /** Ask first when dirty; run `proceed` straight away when not. Returns whether it ran now. */
  guardLeave: (proceed: () => void, opener?: HTMLElement | null) => boolean
  leave: LeaveRequest | null
  leaveSaving: boolean
  confirmLeave: () => void
  saveAndLeave: () => Promise<void>
  stay: () => void
}

/**
 * Unsaved-change tracking for one editor.
 *
 * Dirty is a comparison of the current form with the last saved one, not "the
 * person touched it": typing a letter and deleting it is clean again. While
 * dirty the hook mirrors the form to localStorage (debounced), stops in-app
 * link clicks with a leave dialog and registers `beforeunload`.
 *
 * Next 16 has no route-change event, so `router.push` and the browser's Back
 * button are not covered; the local copy is what keeps an edit in that case.
 */
export function useDirtyGuard<T>(options: DirtyGuardOptions<T>): DirtyGuard<T> {
  const { value, initial, version = null } = options
  // Every key below is this user's: see `ownedKey`.
  const { user } = useAuth()
  const owner = user?.id ?? null
  const formKey = ownedKey(owner, options.formKey)
  const optionsRef = useRef(options)

  const [core, setCore] = useState<{ key: string; saved: T; version: string | null }>({
    key: formKey,
    saved: initial,
    version,
  })
  // A different record: take its saved form now, in this render, so there is
  // never a frame comparing the new form with the old record's baseline.
  const live = core.key === formKey ? core : { key: formKey, saved: initial, version }
  if (core.key !== formKey) setCore(live)
  // The version follows the page's `updatedAt`, but only together with the
  // content it belongs to. After this editor's own save or a site fetch the
  // refreshed record matches the baseline, so the new version is taken. A
  // refresh after someone else's save (a finished run refreshes every admin
  // page) brings content this form was never compared with: keep the old
  // version, so a copy made now still asks before it is put back.
  const [seenVersion, setSeenVersion] = useState(version)
  if (seenVersion !== version) {
    setSeenVersion(version)
    if (sameValue(initial, live.saved)) setCore({ ...live, version })
  }

  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [restore, setRestore] = useState<RestoreState<T> | null>(null)
  const [leave, setLeave] = useState<LeaveRequest | null>(null)
  const [leaveSaving, setLeaveSaving] = useState(false)

  const changeCount = changeCountOf(value, live.saved, options.countChanges)
  const dirty = options.countChanges ? changeCount > 0 : !sameValue(value, live.saved)
  const changed = dirty ? changedKeys(value, live.saved) : []
  const dirtyRef = useRef(dirty)
  const versionRef = useRef(live.version)
  const waitingRef = useRef(false)
  const savedRef = useRef(live.saved)
  const keyRef = useRef(live.key)
  // Set while an anchor click is being replayed after the person chose to
  // leave, so the capture listener lets that one through.
  const replaying = useRef(false)
  // A confirmed hard navigation must not also trigger the browser's own prompt.
  const hardLeaving = useRef(false)
  // A key `markSaved` has just moved this form to: that is the same form, saved.
  const adoptedKey = useRef<string | null>(null)

  // Handlers and listeners read the latest render's values through refs.
  useEffect(() => {
    optionsRef.current = options
    dirtyRef.current = dirty
    versionRef.current = live.version
    savedRef.current = live.saved
    keyRef.current = live.key
  })

  /** Mirror the form now: leaving cannot wait for the debounce. */
  const flush = () => {
    if (!dirtyRef.current || waitingRef.current) return
    writeLocalCopy(keyRef.current, {
      value: optionsRef.current.value,
      savedAt: versionRef.current,
      at: Date.now(),
    })
  }
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })

  // Leaving the editor by any route, including ones no click listener sees
  // (router.push, a redirect), keeps what was typed.
  useEffect(() => () => flushRef.current(), [])

  // On load and on switching record: put back an edit that was never saved.
  useEffect(() => {
    if (adoptedKey.current === formKey) {
      adoptedKey.current = null
      return
    }
    setLeave(null)
    setSavedAt(null)
    const copy = readLocalCopy<T>(formKey)
    const decision = restoreDecision(copy, savedRef.current, live.version)
    if (!copy || decision === 'none') {
      if (copy) clearLocalCopy(formKey)
      setRestore(null)
      return
    }
    if (decision === 'apply') {
      optionsRef.current.onReset(copy.value)
      setRestore({ kind: 'restored', at: copy.at })
    } else {
      setRestore({ kind: 'stale', at: copy.at, value: copy.value })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a different record re-runs this
  }, [formKey])

  // Mirror the form while it differs from what is saved; drop the copy once it
  // does not. A copy waiting on the person's answer is left alone.
  const valueJson = JSON.stringify(value)
  const waiting = restore?.kind === 'stale'
  useEffect(() => {
    waitingRef.current = waiting
  })
  useEffect(() => {
    if (waiting) return
    const timer = setTimeout(() => {
      if (dirtyRef.current) {
        writeLocalCopy(keyRef.current, {
          value: optionsRef.current.value,
          savedAt: live.version,
          at: Date.now(),
        })
      } else {
        clearLocalCopy(keyRef.current)
      }
    }, LOCAL_WRITE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [formKey, valueJson, dirty, live.version, waiting])

  const markSaved: DirtyGuard<T>['markSaved'] = (next, extra) => {
    const key = extra?.key ? ownedKey(owner, extra.key) : keyRef.current
    if (key !== keyRef.current) adoptedKey.current = key
    clearLocalCopy(keyRef.current)
    clearLocalCopy(key)
    // Now, not on the next render: "Save and leave" navigates straight after
    // this, and the unload and unmount flushes read these refs. Still dirty,
    // they would write the pre-save copy back.
    dirtyRef.current = false
    savedRef.current = next
    keyRef.current = key
    if (extra?.version !== undefined) versionRef.current = extra.version
    setCore((current) => ({
      key,
      saved: next,
      version: extra?.version === undefined ? current.version : extra.version,
    }))
    setSavedAt(new Date())
    setRestore(null)
  }

  const submit = async () => {
    const run = optionsRef.current.save
    if (!run) return false
    setSaving(true)
    try {
      const result = await run(savedRef.current)
      if (!result) return false
      markSaved(result.saved, { version: result.version, key: result.key })
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    optionsRef.current.onReset(savedRef.current)
    clearLocalCopy(keyRef.current)
    setRestore(null)
  }

  const guardLeave: DirtyGuard<T>['guardLeave'] = (proceed, opener) => {
    if (!dirtyRef.current || replaying.current) {
      proceed()
      return true
    }
    flush()
    const active = typeof document === 'undefined' ? null : document.activeElement
    setLeave({
      proceed,
      opener: opener ?? (active instanceof HTMLElement && active !== document.body ? active : null),
    })
    return false
  }
  const guardLeaveRef = useRef(guardLeave)
  useEffect(() => {
    guardLeaveRef.current = guardLeave
  })

  const confirmLeaveWith = (request: LeaveRequest) => {
    setLeave(null)
    replaying.current = true
    hardLeaving.current = true
    try {
      request.proceed()
    } finally {
      replaying.current = false
    }
    setTimeout(() => {
      hardLeaving.current = false
    }, 2000)
  }

  const confirmLeave = () => {
    if (leave) confirmLeaveWith(leave)
  }

  const stay = () => {
    const opener = leave?.opener
    setLeave(null)
    // After the dialog has unmounted, so its own focus handling is not racing this.
    setTimeout(() => {
      if (opener?.isConnected) opener.focus()
    }, 0)
  }

  const saveAndLeave = async () => {
    if (!leave) return
    setLeaveSaving(true)
    const ok = await submit()
    setLeaveSaving(false)
    // A failed save stays on the page, where the editor's inline error is.
    if (ok) confirmLeaveWith(leave)
    else stay()
  }
  // Only while there is something to lose: a form that is clean adds no
  // listeners, so it never gets a browser prompt for a page with nothing in it.
  useEffect(() => {
    if (!dirty) return
    const onClick = (event: MouseEvent) => {
      if (replaying.current) return
      const anchor = guardedAnchor(event, {
        href: window.location.href,
        origin: window.location.origin,
      })
      if (!anchor) return
      event.preventDefault()
      event.stopImmediatePropagation()
      guardLeaveRef.current(() => {
        if (anchor.isConnected) anchor.click()
        else window.location.assign(anchor.href)
      }, anchor)
    }
    const onUnload = (event: BeforeUnloadEvent) => {
      // A confirmed leave has already flushed (Leave) or saved (Save and leave).
      if (hardLeaving.current) return
      flushRef.current()
      event.preventDefault()
      event.returnValue = ''
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [dirty])

  return {
    dirty,
    saved: live.saved,
    changeCount,
    changed,
    labels: options.labels ?? {},
    savedAt,
    saving,
    submit,
    markSaved,
    discard,
    restore,
    keepMine: () => {
      if (restore?.kind !== 'stale') return
      optionsRef.current.onReset(restore.value)
      setRestore(null)
    },
    dismissRestore: () => {
      clearLocalCopy(keyRef.current)
      setRestore(null)
    },
    guardLeave,
    leave,
    leaveSaving,
    confirmLeave,
    saveAndLeave,
    stay,
  }
}
