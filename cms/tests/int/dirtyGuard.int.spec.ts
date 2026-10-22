import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ user: { id: 7 } as { id: number } | null }))
vi.mock('@payloadcms/ui', () => ({ useAuth: () => ({ user: auth.user }) }))

import {
  agoLabel,
  changeCountOf,
  changedKeys,
  describeChanged,
  guardedAnchor,
  LOCAL_COPY_TTL_MS,
  ownedKey,
  readLocalCopy,
  restoreDecision,
  sameValue,
  saveLabel,
  storageKey,
  writeLocalCopy,
} from '@/components/ops/dirtyGuardCore'
import { LeaveDialog, RestoreNotice, SaveButton } from '@/components/ops/DirtyGuardUi'
import { useDirtyGuard, type SavedResult } from '@/components/ops/useDirtyGuard'
import { evidenceSaveMessage, parsedSaveMessage, workspaceSaveMessage } from '@/components/ops/saveMessages'

/**
 * F5: what counts as unsaved, the local copy, the restore rules, the leave
 * guard's click rules, and the honest Save label — the pure rules against plain
 * objects, then the hook and its dialog against jsdom's own localStorage.
 */

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0)

describe('dirty compare', () => {
  it('compares by value, not by key order', () => {
    expect(sameValue({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true)
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('counts changed top-level keys by default', () => {
    const saved = { name: 'a', rows: [1], seo: { max: 60 } }
    expect(changedKeys({ ...saved }, saved)).toEqual([])
    expect(changedKeys({ ...saved, name: 'b', seo: { max: 70 } }, saved)).toEqual(['name', 'seo'])
    expect(changeCountOf({ ...saved, rows: [1, 2] }, saved)).toBe(1)
  })

  it('lets an editor count in its own terms, and say nothing changed', () => {
    const count = (value: number[], saved: number[]) => value.filter((n) => n > 0).length - saved.length
    expect(changeCountOf([1, 0], [1], count)).toBe(0)
    expect(changeCountOf([1, 2, 0], [1], count)).toBe(1)
  })

  it('names what changed for the leave dialog', () => {
    expect(describeChanged([], {})).toBe('this form')
    expect(describeChanged(['outline'], { outline: 'the outline' })).toBe('the outline')
    expect(describeChanged(['dos', 'donts'], { dos: 'the dos', donts: 'the don’ts' })).toBe(
      'the dos and the don’ts',
    )
    expect(describeChanged(['a', 'b', 'c', 'd'])).toBe('a, b and 2 more')
  })
})

describe('Save label', () => {
  const base = { dirty: false, changeCount: 0, saving: false, savedAt: null as Date | null }

  it('says what is true of the form', () => {
    expect(saveLabel(base)).toBe('Save')
    expect(saveLabel({ ...base, dirty: true, changeCount: 3 })).toBe('Save')
    expect(saveLabel({ ...base, dirty: true, changeCount: 3 }, true)).toBe('Save 3 changes')
    expect(saveLabel({ ...base, dirty: true, changeCount: 1 }, true)).toBe('Save 1 change')
    expect(saveLabel({ ...base, dirty: true, changeCount: 3, saving: true })).toBe('Saving…')
    expect(saveLabel({ ...base, savedAt: new Date(NOW) })).toMatch(/^Saved · \d{1,2}:\d{2}/)
  })
})

describe('local copy', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a copy, and ignores one that is corrupt, malformed or from another shape', () => {
    writeLocalCopy('k', { value: { a: 1 }, savedAt: 'v1', at: NOW })
    expect(readLocalCopy('k', NOW + 1000)).toEqual({ value: { a: 1 }, savedAt: 'v1', at: NOW })

    localStorage.setItem(storageKey('bad'), '{not json')
    expect(readLocalCopy('bad', NOW)).toBeNull()
    localStorage.setItem(storageKey('shape'), JSON.stringify({ value: 1 }))
    expect(readLocalCopy('shape', NOW)).toBeNull()
    localStorage.setItem(storageKey('null'), 'null')
    expect(readLocalCopy('null', NOW)).toBeNull()
  })

  it('expires after 24 hours and removes the copy', () => {
    writeLocalCopy('k', { value: 1, savedAt: null, at: NOW })
    expect(readLocalCopy('k', NOW + LOCAL_COPY_TTL_MS)).not.toBeNull()
    expect(readLocalCopy('k', NOW + LOCAL_COPY_TTL_MS + 1)).toBeNull()
    expect(localStorage.getItem(storageKey('k'))).toBeNull()
  })

  it('never throws when storage does', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    expect(readLocalCopy('k', NOW, broken)).toBeNull()
    expect(() => writeLocalCopy('k', { value: 1, savedAt: null, at: NOW }, broken)).not.toThrow()
    expect(readLocalCopy('k', NOW, null)).toBeNull()
  })

  it('decides: apply on the same version, ask on a newer one, nothing when equal', () => {
    const copy = { value: { a: 2 }, savedAt: 'v1', at: NOW }
    expect(restoreDecision(copy, { a: 1 }, 'v1')).toBe('apply')
    expect(restoreDecision(copy, { a: 1 }, 'v2')).toBe('ask')
    expect(restoreDecision(copy, { a: 2 }, 'v1')).toBe('none')
    expect(restoreDecision(null, { a: 1 }, 'v1')).toBe('none')
    // A record that has no version yet matches a copy made before it had one.
    expect(restoreDecision({ ...copy, savedAt: null }, { a: 1 }, null)).toBe('apply')
  })

  it('words its age', () => {
    expect(agoLabel(NOW - 30_000, NOW)).toBe('1 minute ago')
    expect(agoLabel(NOW - 2 * 60_000, NOW)).toBe('2 minutes ago')
    expect(agoLabel(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago')
  })
})

describe('which clicks the leave guard stops', () => {
  beforeEach(() => window.history.replaceState({}, '', '/admin/ops/templates?id=1'))
  const here = { get href() { return window.location.href }, get origin() { return window.location.origin } }
  const click = (html: string, init: Partial<MouseEventInit> = {}) => {
    const holder = document.createElement('div')
    holder.innerHTML = html
    const anchor = holder.querySelector('a')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
    Object.defineProperty(event, 'target', { value: anchor.querySelector('span') ?? anchor })
    return guardedAnchor(event, here)
  }

  it('stops a plain same-origin link, even from a child element', () => {
    expect(click('<a href="/admin/ops/content">Content</a>')).not.toBeNull()
    expect(click('<a href="/admin/ops/content"><span>Content</span></a>')).not.toBeNull()
  })

  it('lets modified clicks, other frames, downloads and other origins through', () => {
    const link = '<a href="/admin/ops/content">Content</a>'
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(click(link, init)).toBeNull()
    }
    expect(click('<a href="/admin/ops/content" target="_blank">x</a>')).toBeNull()
    expect(click('<a href="/admin/ops/content" target="_self">x</a>')).not.toBeNull()
    expect(click('<a href="/file.csv" download>x</a>')).toBeNull()
    expect(click('<a href="https://example.com/">x</a>')).toBeNull()
    expect(click('<a href="mailto:a@b.co">x</a>')).toBeNull()
  })

  it('lets a link that stays on this page through', () => {
    expect(click('<a href="#section">x</a>')).toBeNull()
    expect(click('<a href="/admin/ops/templates?id=1#section">x</a>')).toBeNull()
    expect(click('<a href="/admin/ops/templates?id=1">x</a>')).toBeNull()
    // The same path with a different query is a different page.
    expect(click('<a href="/admin/ops/templates?id=2">x</a>')).not.toBeNull()
  })
})

describe('save messages say what was kept and dropped', () => {
  it('evidence', () => {
    expect(evidenceSaveMessage({ claims: 4, facts: 0, rejected: 0, skipped: 1 })).toBe(
      'Saved · 4 claims, 1 empty row skipped',
    )
    expect(evidenceSaveMessage({ claims: 1, facts: 2, rejected: 1, skipped: 0 })).toBe(
      'Saved · 1 claim, 2 facts, 1 rejected or expired',
    )
  })

  it('workspace', () => {
    expect(workspaceSaveMessage({ competitors: 2, invalid: 1, duplicate: 0 })).toBe(
      'Saved · 2 competitors kept, 1 invalid removed',
    )
    expect(workspaceSaveMessage({ competitors: 1, invalid: 0, duplicate: 2 })).toBe(
      'Saved · 1 competitor kept, 2 duplicate removed',
    )
    expect(workspaceSaveMessage({ competitors: 0, invalid: 0, duplicate: 0 })).toBe('Saved')
  })

  it('parsed assets', () => {
    expect(parsedSaveMessage('Saved Acme.', 0)).toBe('Saved Acme.')
    expect(parsedSaveMessage('Saved Acme.', 2)).toBe('Saved · 2 incomplete rows removed')
  })
})

type Form = { a: string; b: string }
const INITIAL: Form = { a: 'one', b: 'two' }

/** The keys the hook writes, as the signed-in user (id 7) of the mock. */
const own = (key: string) => ownedKey(7, key)

function Harness({
  formKey = 'form:1',
  initial = INITIAL,
  version = 'v1',
  save,
  onReset,
}: {
  formKey?: string
  initial?: Form
  version?: string | null
  save?: (baseline: Form) => Promise<SavedResult<Form> | null>
  onReset?: (value: Form) => void
}) {
  const [value, setValue] = useState(initial)
  const guard = useDirtyGuard<Form>({
    formKey,
    value,
    initial,
    version,
    onReset: (next) => {
      onReset?.(next)
      setValue(next)
    },
    labels: { a: 'the first field', b: 'the second field' },
    save: save ?? (async () => ({ saved: value })),
  })
  const h = React.createElement
  return h(
    'div',
    null,
    h(RestoreNotice, { guard }),
    h('input', {
      'aria-label': 'a',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue({ ...value, a: e.target.value }),
      value: value.a,
    }),
    h('input', {
      'aria-label': 'b',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue({ ...value, b: e.target.value }),
      value: value.b,
    }),
    h(SaveButton, { guard, onClick: () => void guard.submit(), pending: false }),
    h('button', { onClick: guard.discard, type: 'button' }, 'Revert'),
    // A switch inside the editor, like picking another template: no unload.
    h('button', { onClick: () => guard.guardLeave(() => {}), type: 'button' }, 'Switch'),
    h('a', { href: '/elsewhere' }, 'Elsewhere'),
    h('a', { href: '#here' }, 'Here'),
    h('a', { href: '/new-tab', target: '_blank' }, 'New tab'),
    h(LeaveDialog, { guard }),
  )
}

type HarnessProps = React.ComponentProps<typeof Harness>
const harness = (props: HarnessProps = {}) => React.createElement(Harness, props)

/** The dot-and-count beside Save. A restore notice is a status too, so not `getByRole`. */
const dirtyStatus = () => document.querySelector('.datum-ops__dirty')?.textContent
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const stored = (key = 'form:1') => {
  const raw = localStorage.getItem(storageKey(own(key)))
  return raw ? (JSON.parse(raw) as { value: Form; savedAt: string | null; at: number }) : null
}

describe('useDirtyGuard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('is dirty by value: typing a letter and deleting it is clean again', () => {
    render(harness())
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(dirtyStatus()).toBe('')

    type('a', 'one!')
    expect(save.disabled).toBe(false)
    expect(dirtyStatus()).toBe('1 unsaved change')

    type('b', 'twoo')
    expect(dirtyStatus()).toBe('2 unsaved changes')

    type('a', 'one')
    type('b', 'two')
    expect(save.disabled).toBe(true)
    expect(dirtyStatus()).toBe('')
  })

  it('mirrors an edit to localStorage after the debounce, with the version it was made on', () => {
    render(harness())
    type('a', 'edited')
    expect(stored()).toBeNull()
    act(() => void vi.advanceTimersByTime(499))
    expect(stored()).toBeNull()
    act(() => void vi.advanceTimersByTime(1))
    expect(stored()).toMatchObject({ value: { a: 'edited', b: 'two' }, savedAt: 'v1', at: NOW + 500 })

    // A later keystroke restarts the wait, and only the last value is written.
    type('a', 'edited again')
    act(() => void vi.advanceTimersByTime(300))
    type('a', 'edited thrice')
    act(() => void vi.advanceTimersByTime(300))
    expect(stored()?.value.a).toBe('edited')
    act(() => void vi.advanceTimersByTime(200))
    expect(stored()?.value.a).toBe('edited thrice')
  })

  it('drops the copy once the form is back to what is saved, and when it is discarded', () => {
    render(harness())
    type('a', 'edited')
    act(() => void vi.advanceTimersByTime(500))
    expect(stored()).not.toBeNull()

    type('a', 'one')
    act(() => void vi.advanceTimersByTime(500))
    expect(stored()).toBeNull()

    type('a', 'edited')
    act(() => void vi.advanceTimersByTime(500))
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }))
    expect(stored()).toBeNull()
    expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('one')
  })

  it('clears the copy on a save and labels the button with the time it saved', async () => {
    render(harness())
    type('a', 'edited')
    act(() => void vi.advanceTimersByTime(500))
    expect(stored()).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    expect(stored()).toBeNull()
    const label = screen.getByRole('button', { name: /^Saved ·/ }) as HTMLButtonElement
    expect(label.disabled).toBe(true)
    act(() => void vi.advanceTimersByTime(1000))
    expect(stored()).toBeNull()
  })

  it('keeps the edit and stays dirty when the save fails', async () => {
    render(harness({ save: async () => null }))
    type('a', 'edited')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    expect(dirtyStatus()).toBe('1 unsaved change')
  })

  it('puts back an unsaved edit made on the version the server still has', () => {
    writeLocalCopy(own('form:1'), { value: { a: 'mine', b: 'two' }, savedAt: 'v1', at: NOW - 2 * 60_000 })
    render(harness())
    expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('mine')
    expect(screen.getByText("Restored the edit you hadn't saved, from 2 minutes ago.")).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('one')
    expect(screen.queryByText(/Restored the edit/)).toBeNull()
    expect(stored()).toBeNull()
  })

  it('asks instead of applying when the record was saved elsewhere since', () => {
    writeLocalCopy(own('form:1'), { value: { a: 'mine', b: 'two' }, savedAt: 'v0', at: NOW - 5 * 60_000 })
    const onReset = vi.fn()
    render(harness({ onReset }))
    expect(onReset).not.toHaveBeenCalled()
    expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('one')
    expect(
      screen.getByText('You have an unsaved edit from 5 minutes ago, but this was saved elsewhere since.'),
    ).toBeTruthy()

    // The question outlives the debounce: the copy is not thrown away unanswered.
    act(() => void vi.advanceTimersByTime(2000))
    expect(stored()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Use mine' }))
    expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('mine')
    expect(screen.queryByText(/saved elsewhere/)).toBeNull()
  })

  it('can discard the older edit instead', () => {
    writeLocalCopy(own('form:1'), { value: { a: 'mine', b: 'two' }, savedAt: 'v0', at: NOW - 60_000 })
    render(harness())
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(stored()).toBeNull()
    expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('one')
  })

  it('ignores a copy that is expired, corrupt, or no different from what is saved', () => {
    writeLocalCopy(own('form:1'), {
      value: { a: 'mine', b: 'two' },
      savedAt: 'v1',
      at: NOW - LOCAL_COPY_TTL_MS - 1000,
    })
    const { unmount } = render(harness())
    expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('one')
    expect(screen.queryByText(/Restored the edit/)).toBeNull()
    unmount()

    localStorage.setItem(storageKey(own('form:1')), '{broken')
    const second = render(harness())
    expect(screen.queryByText(/Restored the edit/)).toBeNull()
    second.unmount()

    writeLocalCopy(own('form:1'), { value: { ...INITIAL }, savedAt: 'v1', at: NOW })
    render(harness())
    expect(screen.queryByText(/Restored the edit/)).toBeNull()
  })

  it('keeps working when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    render(harness())
    type('a', 'edited')
    expect(() => act(() => void vi.advanceTimersByTime(600))).not.toThrow()
    expect(dirtyStatus()).toBe('1 unsaved change')
  })

  it('registers beforeunload only while there is something unsaved', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const unloadAdds = () => add.mock.calls.filter(([name]) => name === 'beforeunload').length
    const unloadRemoves = () => remove.mock.calls.filter(([name]) => name === 'beforeunload').length

    render(harness())
    expect(unloadAdds()).toBe(0)

    type('a', 'edited')
    expect(unloadAdds()).toBe(1)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)

    type('a', 'one')
    expect(unloadRemoves()).toBe(1)
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
  })

  it('does not touch link clicks while the form is clean', () => {
    render(harness())
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    const prevented = !screen.getByRole('link', { name: 'Elsewhere' }).dispatchEvent(click)
    // jsdom's own "navigation not implemented" is the default action; nothing stopped it.
    expect(click.defaultPrevented).toBe(prevented)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  describe('with unsaved changes', () => {
    /** Counts the clicks that get past the guard, and keeps jsdom from navigating. */
    let reached: MouseEvent[]
    const collect = (event: MouseEvent) => {
      if (!(event.target as Element).closest('a')) return
      reached.push(event)
      event.preventDefault()
    }
    beforeEach(() => {
      reached = []
      document.addEventListener('click', collect)
    })
    afterEach(() => document.removeEventListener('click', collect))

    it('asks before an in-app link, names what is unsaved, and Stay keeps the edit and the focus', () => {
      render(harness())
      type('a', 'edited')
      const link = screen.getByRole('link', { name: 'Elsewhere' })
      link.focus()
      fireEvent.click(link)

      const dialog = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
      expect(dialog.getAttribute('aria-modal')).toBe('true')
      expect(dialog.textContent).toContain('Your changes to the first field will be lost.')
      expect(dialog.textContent).toContain('local copy for 24 hours')
      expect(reached).toHaveLength(0)
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay' }))
      // The edit is already on its way to storage, so "we'll keep a copy" is true.
      expect(stored()?.value.a).toBe('edited')

      fireEvent.keyDown(dialog, { key: 'Escape' })
      expect(screen.queryByRole('alertdialog')).toBeNull()
      act(() => void vi.advanceTimersByTime(10))
      expect(document.activeElement).toBe(link)
      expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('edited')
      expect(reached).toHaveLength(0)
    })

    it('keeps Tab inside the dialog', () => {
      render(harness())
      type('a', 'edited')
      fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }))
      const dialog = screen.getByRole('alertdialog')
      const stay = screen.getByRole('button', { name: 'Stay' })
      const first = screen.getByRole('button', { name: 'Save and leave' })

      expect(document.activeElement).toBe(stay)
      fireEvent.keyDown(dialog, { key: 'Tab' })
      expect(document.activeElement).toBe(first)
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(stay)
    })

    it('Leave lets the click through', () => {
      render(harness())
      type('a', 'edited')
      fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }))
      fireEvent.click(screen.getByRole('button', { name: 'Leave' }))

      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(reached).toHaveLength(1)
      expect((reached[0].target as HTMLAnchorElement).getAttribute('href')).toBe('/elsewhere')
    })

    it('Save and leave saves first, and only then lets the click through', async () => {
      let finish: (value: SavedResult<Form>) => void = () => {}
      const save = vi.fn(
        () => new Promise<SavedResult<Form> | null>((resolve) => (finish = resolve)),
      )
      render(harness({ save }))
      type('a', 'edited')
      fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save and leave' }))
      })
      expect(save).toHaveBeenCalledTimes(1)
      expect(reached).toHaveLength(0)
      expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Saving…' })).toBeTruthy()

      await act(async () => finish({ saved: { a: 'edited', b: 'two' } }))
      expect(reached).toHaveLength(1)
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('Save and leave leaves no copy behind, even when the page unloads at once', async () => {
      const { unmount } = render(harness())
      type('a', 'edited')
      fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }))
      expect(stored()).not.toBeNull()
      // A hard navigation: the replayed click unloads the page before React
      // has rendered the save, then the editor unmounts.
      const unload = () => window.dispatchEvent(new Event('beforeunload'))
      document.addEventListener('click', unload)
      try {
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Save and leave' }))
        })
      } finally {
        document.removeEventListener('click', unload)
      }
      expect(reached).toHaveLength(1)
      unmount()
      expect(stored()).toBeNull()
    })

    it('Save and leave stays on the page when the save fails', async () => {
      render(harness({ save: async () => null }))
      type('a', 'edited')
      const link = screen.getByRole('link', { name: 'Elsewhere' })
      fireEvent.click(link)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save and leave' }))
      })
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(reached).toHaveLength(0)
    })

    it('still warns on a reload right after a switch that stayed on the page', () => {
      render(harness())
      type('a', 'edited')
      fireEvent.click(screen.getByRole('button', { name: 'Switch' }))
      fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
      expect(screen.queryByRole('alertdialog')).toBeNull()

      const unload = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(unload)
      expect(unload.defaultPrevented).toBe(true)
    })

    it('lets new-tab and same-page links be', () => {
      render(harness())
      type('a', 'edited')
      fireEvent.click(screen.getByRole('link', { name: 'New tab' }))
      fireEvent.click(screen.getByRole('link', { name: 'Here' }))
      fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }), { metaKey: true })
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(reached).toHaveLength(3)
    })
  })

  it('never hands an unsaved draft to another person on the same browser', () => {
    const first = render(harness())
    type('a', 'mine')
    act(() => void vi.advanceTimersByTime(500))
    expect(stored()?.value.a).toBe('mine')
    first.unmount()

    auth.user = { id: 8 }
    try {
      render(harness())
      expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe(INITIAL.a)
      expect(screen.queryByText(/Restored the edit/)).toBeNull()
      expect(dirtyStatus()).toBe('')
    } finally {
      auth.user = { id: 7 }
    }
  })

  it('takes a refreshed version only with the content it belongs to', () => {
    const { rerender } = render(harness({ version: 'v1' }))
    type('a', 'edited')

    // Someone else saved: the refreshed page brings their content with v2.
    rerender(harness({ version: 'v2', initial: { ...INITIAL, b: 'theirs' } }))
    act(() => void vi.advanceTimersByTime(500))
    expect(stored()?.savedAt).toBe('v1')

    // A refresh that saved nothing new to this form (a site fetch, say).
    rerender(harness({ version: 'v3', initial: INITIAL }))
    type('a', 'edited again')
    act(() => void vi.advanceTimersByTime(500))
    expect(stored()?.savedAt).toBe('v3')
  })

  it('treats a different formKey as a different record, with its own baseline and copy', () => {
    writeLocalCopy(own('form:2'), { value: { a: 'two-mine', b: 'two' }, savedAt: 'v1', at: NOW - 60_000 })
    const { rerender } = render(harness({ formKey: 'form:1' }))
    expect(dirtyStatus()).toBe('')

    rerender(harness({ formKey: 'form:2', initial: { a: 'two-orig', b: 'two' } }))
    // The copy for the second record was made on its own baseline, not the first's.
    expect((screen.getByLabelText('a') as HTMLInputElement).value).toBe('two-mine')
    expect(dirtyStatus()).toBe('1 unsaved change')
  })
})
