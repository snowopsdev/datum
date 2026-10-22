import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { BriefAngleOption } from '../../../pipeline/src/brief'

/**
 * The suggested angles are one radio group: a single checked card, arrow keys
 * that move the choice and the focus together, and one tab stop. Nothing about
 * that is visible in markup alone, so these pin the behaviour a keyboard or a
 * screen reader relies on.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('@payloadcms/ui', () => ({ toast: { success: vi.fn(), dismiss: vi.fn() } }))
vi.mock('@/components/ops/briefActions', () => ({
  approveBriefAction: vi.fn(async () => ({ ok: true, message: 'Approved' })),
  saveBriefAction: vi.fn(async () => ({ ok: true, message: 'Saved' })),
}))

const { BriefEditor } = await import('@/components/ops/BriefEditor')

afterEach(cleanup)

const angleOptions: BriefAngleOption[] = [
  {
    angle: 'Choose a budget grinder with a used-equipment checklist',
    rationale: 'Answers the equipment confusion.',
    pain: 'pod upgrader',
    gaps: ['Buying used'],
  },
  {
    angle: 'Dial in espresso by checking water first',
    rationale: "Answers the reader's wasted beans.",
    pain: null,
    gaps: ['Water quality'],
  },
  {
    angle: 'Clean the group head before every shot',
    rationale: 'Answers the bitter shots.',
    pain: null,
    gaps: [],
  },
]

function editor(angle: string) {
  return React.createElement(BriefEditor, {
    articleId: 1,
    keyword: 'espresso grinder',
    templateName: 'How-To',
    mode: 'mock',
    icps: [],
    initial: {
      angleOptions,
      angle,
      audience: '',
      sections: [],
      mustCover: [],
      opportunities: [],
      notes: '',
      icpId: null,
    },
  })
}

const radios = () =>
  within(screen.getByRole('radiogroup', { name: 'Suggested angles' })).getAllByRole('radio')
const checked = () => radios().map((radio) => radio.getAttribute('aria-checked'))

it('renders the angles as one radio group with exactly the matching card checked', () => {
  render(editor(angleOptions[1].angle))

  expect(checked()).toEqual(['false', 'true', 'false'])
  expect(radios()[1].className).toContain('is-selected')
  expect(radios()[1].textContent).toContain('For: Template direction')
  expect(radios()[1].textContent).toContain('Fills: Water quality')
})

it('keeps one tab stop on the chosen card, or the first card when the angle is typed by hand', () => {
  const { unmount } = render(editor(angleOptions[2].angle))
  expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, -1, 0])
  unmount()

  render(editor('Something the editor wrote'))
  expect(checked()).toEqual(['false', 'false', 'false'])
  expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1, -1])
})

it('moves the choice and the focus with the arrow keys, wrapping at both ends', () => {
  render(editor(angleOptions[0].angle))
  const [first, second, third] = radios()

  fireEvent.keyDown(first, { key: 'ArrowDown' })
  expect(checked()).toEqual(['false', 'true', 'false'])
  expect(document.activeElement).toBe(second)

  fireEvent.keyDown(second, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(third)

  fireEvent.keyDown(third, { key: 'ArrowDown' })
  expect(checked()).toEqual(['true', 'false', 'false'])
  expect(document.activeElement).toBe(first)

  fireEvent.keyDown(first, { key: 'ArrowUp' })
  expect(checked()).toEqual(['false', 'false', 'true'])
  expect(document.activeElement).toBe(third)
})

it('jumps to the first and last card with Home and End', () => {
  render(editor(angleOptions[1].angle))
  const second = radios()[1]

  fireEvent.keyDown(second, { key: 'End' })
  expect(checked()).toEqual(['false', 'false', 'true'])

  fireEvent.keyDown(radios()[2], { key: 'Home' })
  expect(checked()).toEqual(['true', 'false', 'false'])
})

it('checks a card on click and then holds the tab stop', () => {
  render(editor(angleOptions[0].angle))

  fireEvent.click(radios()[2])

  expect(checked()).toEqual(['false', 'false', 'true'])
  expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, -1, 0])
  expect(screen.getByDisplayValue(angleOptions[2].angle)).toBeTruthy()
})
