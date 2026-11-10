// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { TemplateConfigDTO } from '@/components/ops/templateTypes'

/**
 * A template saves through a lossy plain-to-Lexical conversion and drops blank
 * list lines, so the editor must show what was stored, not what was typed.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('@payloadcms/ui', () => ({
  toast: { success: vi.fn(), dismiss: vi.fn() },
  useAuth: () => ({ user: { id: 1 } }),
}))
vi.mock('@/components/ops/templateActions', () => ({
  createTemplateAction: vi.fn(),
  saveTemplateConfigAction: vi.fn(),
}))

const { TemplateConfigEditor } = await import('@/components/ops/TemplateConfigEditor')
const { saveTemplateConfigAction } = await import('@/components/ops/templateActions')

afterEach(cleanup)

const template: TemplateConfigDTO = {
  id: 3,
  name: 'Comparison',
  updatedAt: '2026-09-01T10:00:00.000Z',
  companyMentions: 'mention',
  outline: '## Verdict',
  example: '',
  dos: ['Name the tool'],
  donts: [],
  requiredSections: ['Verdict'],
  seoSpec: {
    titleTagMaxLength: 60,
    metaDescriptionMaxLength: 160,
    headingStructureRules: '',
    faqRequired: false,
    faqMinQuestions: null,
    faqMaxQuestions: null,
    ogTagsRequired: true,
  },
}

it('shows the outline as stored after a save, so trimmed text is not left looking saved', async () => {
  localStorage.clear()
  vi.mocked(saveTemplateConfigAction).mockResolvedValueOnce({
    ok: true,
    dropped: 0,
    updatedAt: '2030-01-01T00:00:00.000Z',
    template: { ...template, outline: '## Verdict\nPick one.', updatedAt: '2030-01-01T00:00:00.000Z' },
  })
  render(React.createElement(TemplateConfigEditor, { templates: [template], initialId: 3 }))
  const outline = () => screen.getByLabelText('Outline') as HTMLTextAreaElement
  fireEvent.change(outline(), { target: { value: '## Verdict\n\nPick one.   \n\n' } })

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(outline().value).toBe('## Verdict\nPick one.')
  expect(document.querySelector('.datum-ops__dirty')?.textContent).toBe('')
})

it('shows the gate’s message when the save is refused, and keeps the edit', async () => {
  localStorage.clear()
  vi.mocked(saveTemplateConfigAction).mockResolvedValueOnce({
    ok: false,
    error: 'Required sections must be unique.',
  })
  render(React.createElement(TemplateConfigEditor, { templates: [template], initialId: 3 }))
  const outline = () => screen.getByLabelText('Outline') as HTMLTextAreaElement
  fireEvent.change(outline(), { target: { value: '## Verdict\n\nPick one.' } })

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(screen.getByText('Required sections must be unique.')).toBeTruthy()
  expect(outline().value).toBe('## Verdict\n\nPick one.')
})

it('marks the open template and the open tab for assistive tech, not just by class', () => {
  localStorage.clear()
  const other: TemplateConfigDTO = { ...template, id: 4, name: 'How-to' }
  render(React.createElement(TemplateConfigEditor, { templates: [template, other], initialId: 3 }))

  expect(screen.getByRole('button', { name: /^Comparison/ }).getAttribute('aria-current')).toBe('true')
  expect(screen.getByRole('button', { name: /^How-to/ }).getAttribute('aria-current')).toBeNull()

  const tab = (name: string) => screen.getByRole('button', { name })
  expect(tab('Outline').getAttribute('aria-pressed')).toBe('true')
  expect(tab('Rules').getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(tab('Rules'))
  expect(tab('Outline').getAttribute('aria-pressed')).toBe('false')
  expect(tab('Rules').getAttribute('aria-pressed')).toBe('true')
})
