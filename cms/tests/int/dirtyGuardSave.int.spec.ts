// @vitest-environment jsdom
import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('@payloadcms/ui', () => ({ useAuth: () => ({ user: { id: 7 } }) }))

import { LeaveDialog } from '@/components/ops/DirtyGuardUi'
import { type SavedResult, useDirtyGuard } from '@/components/ops/useDirtyGuard'

/**
 * How a save ends: a rejected one says so through `onError`, and a save that is
 * already running is the save, so a second trigger (Save and leave pressed
 * during it) never submits twice.
 */

type Form = { a: string }

function Harness({
  save,
  onError,
}: {
  save: (baseline: Form, version: string | null) => Promise<SavedResult<Form> | null>
  onError?: (message: string) => void
}) {
  const [value, setValue] = useState<Form>({ a: 'one' })
  const guard = useDirtyGuard<Form>({
    formKey: 'save-test',
    value,
    initial: { a: 'one' },
    version: 'v1',
    onReset: setValue,
    save,
    onError,
  })
  return React.createElement(
    'div',
    null,
    React.createElement('input', {
      'aria-label': 'a',
      value: value.a,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue({ a: e.target.value }),
    }),
    React.createElement('button', { onClick: () => void guard.submit(), type: 'button' }, 'Save'),
    React.createElement('span', { 'data-testid': 'saving' }, String(guard.saving)),
    React.createElement('a', { href: '/elsewhere' }, 'Elsewhere'),
    React.createElement(LeaveDialog, { guard }),
  )
}

beforeEach(() => {
  localStorage.clear()
  // A click on a link the guard lets through would otherwise try to navigate.
  document.addEventListener('click', (e) => e.preventDefault())
})
afterEach(cleanup)

const edit = () => fireEvent.change(screen.getByLabelText('a'), { target: { value: 'edited' } })

it('reports a save that throws, with the reason, and stays dirty', async () => {
  const onError = vi.fn()
  render(
    React.createElement(Harness, {
      onError,
      save: async () => {
        throw new Error('Failed to fetch')
      },
    }),
  )
  edit()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError.mock.calls[0][0]).toContain('Failed to fetch')
  expect(screen.getByTestId('saving').textContent).toBe('false')
})

it('says something even when the thrown value carries no message', async () => {
  const onError = vi.fn()
  render(
    React.createElement(Harness, {
      onError,
      save: async () => {
        throw undefined
      },
    }),
  )
  edit()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(onError.mock.calls[0][0]).toMatch(/connection/i)
})

it('does not submit again while a save is running, and Save and leave waits for it', async () => {
  let finish: (value: SavedResult<Form>) => void = () => {}
  const save = vi.fn(() => new Promise<SavedResult<Form> | null>((resolve) => (finish = resolve)))
  render(React.createElement(Harness, { save }))
  edit()

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  // A second press while it runs joins it rather than starting another.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(save).toHaveBeenCalledTimes(1)

  // Leaving mid-save: the dialog's buttons are all off, so it cannot submit twice.
  fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }))
  const dialog = await screen.findByRole('alertdialog')
  for (const button of dialog.querySelectorAll('button')) {
    expect((button as HTMLButtonElement).disabled).toBe(true)
  }
  expect(save).toHaveBeenCalledTimes(1)

  await act(async () => finish({ saved: { a: 'edited' }, version: 'v2' }))
  expect(save).toHaveBeenCalledTimes(1)
})

it('hands the save the version the form is based on', async () => {
  const save = vi.fn(async (_baseline: Form, _version: string | null) => ({
    saved: { a: 'edited' },
    version: 'v2',
  }))
  render(React.createElement(Harness, { save }))
  edit()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(save).toHaveBeenLastCalledWith({ a: 'one' }, 'v1')
  edit()
  fireEvent.change(screen.getByLabelText('a'), { target: { value: 'edited again' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  // After a save the next one is based on what that save returned.
  expect(save).toHaveBeenLastCalledWith({ a: 'edited' }, 'v2')
})
