import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * F3: the motion tokens in ops.css. Durations are the approved set, reduced
 * motion zeroes every one of them, and no stylesheet literal bypasses them —
 * the 1.4s run pulse is the single exception and has its own guard.
 */
const css = readFileSync(path.resolve(process.cwd(), 'src/components/ops/ops.css'), 'utf8')

const rootBlock = css.slice(css.indexOf('\n:root {'), css.indexOf('\n}', css.indexOf('\n:root {')))
const reducedBlock = css.slice(
  css.indexOf('@media (prefers-reduced-motion: reduce) {\n  :root {'),
  css.indexOf('\n}\n', css.indexOf('@media (prefers-reduced-motion: reduce) {\n  :root {')),
)
const decl = (block: string, name: string) =>
  new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1].trim()

describe('motion tokens', () => {
  const durations = { instant: '90ms', fast: '140ms', base: '220ms', slow: '360ms', emph: '520ms' }

  it.each(Object.entries(durations))('--ds-dur-%s is %s', (name, value) => {
    expect(decl(rootBlock, `--ds-dur-${name}`)).toBe(value)
  })

  it('declares the three easings', () => {
    expect(decl(rootBlock, '--ds-ease-standard')).toBe('cubic-bezier(0.2, 0, 0, 1)')
    expect(decl(rootBlock, '--ds-ease-decel')).toBe('cubic-bezier(0, 0, 0, 1)')
    expect(decl(rootBlock, '--ds-ease-accel')).toBe('cubic-bezier(0.3, 0, 1, 1)')
  })

  it('zeroes every duration under prefers-reduced-motion', () => {
    for (const name of Object.keys(durations)) {
      expect(decl(reducedBlock, `--ds-dur-${name}`)).toBe('0ms')
    }
  })

  it('leaves no literal transition or animation duration except the run pulse', () => {
    const literals = [...css.matchAll(/^\s*(?:transition|animation):[^;]*?\b\d+(?:\.\d+)?m?s\b/gm)]
    expect(literals.map((m) => m[0].trim())).toEqual(['animation: datum-runbar-pulse 1.4s'])
  })
})
