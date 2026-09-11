import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

/**
 * The curated ops nav is the only navigation in the admin — every collection
 * and global sets `admin.group: false`, so Payload renders none of its own.
 * That makes this list the whole map of the product, and these assertions pin
 * the five groups an operator navigates by and the one href per asset.
 */
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/ops/content' }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}))

const { ExtraOpsNavLinks } = await import('@/components/ops/ExtraOpsNavLinks')

afterEach(cleanup)

const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href')

it('groups the nav into Content, Setup, Governance, Settings and Records', () => {
  render(React.createElement(ExtraOpsNavLinks))
  const groups = Array.from(document.querySelectorAll('.datum-ops-nav__label')).map((node) =>
    node.textContent?.trim(),
  )
  expect(groups).toEqual(['Content', 'Setup', 'Governance', 'Settings', 'Records'])
})

it('gives the webhook settings a nav entry', () => {
  render(React.createElement(ExtraOpsNavLinks))
  expect(hrefOf('Webhooks')).toBe('/admin/globals/webhook-settings')
})

it('puts brand voice under setup, beside the other workspace assets', () => {
  render(React.createElement(ExtraOpsNavLinks))
  expect(hrefOf('Brand voice')).toBe('/admin/ops/setup/brand-voice')
})

it('keeps the governance group to the sources and the policies that judge them', () => {
  render(React.createElement(ExtraOpsNavLinks))
  expect(hrefOf('Sources')).toBe('/admin/collections/evidence-sources')
  expect(hrefOf('Source review')).toBe('/admin/ops/governance/source-review')
  expect(hrefOf('Scoring policy')).toBe('/admin/globals/information-gain-policy')
  expect(hrefOf('Models')).toBe('/admin/globals/llm-settings')
})

it('offers no second surface for an asset that already has an ops editor', () => {
  render(React.createElement(ExtraOpsNavLinks))
  const shadowed = ['/admin/globals/workspace-profile', '/admin/globals/positioning', '/admin/globals/evidence-bank']
  const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'))
  for (const href of shadowed) {
    expect(hrefs, `${href} is shadowed by an ops editor`).not.toContain(href)
  }
})
