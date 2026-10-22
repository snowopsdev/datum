import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Enforces the colour-token rule (F1): the `--ds-*` literals in ops.css keep
 * WCAG AA contrast in light and dark. Parses the token blocks themselves, so a
 * changed value fails here instead of passing review by eye.
 *   text >= 4.5:1; non-text (decoration, focus ring, filled buttons) >= 3:1.
 */
const css = readFileSync(path.resolve(process.cwd(), 'src/components/ops/ops.css'), 'utf8')

const blockAfter = (selector: string): string => {
  const start = css.indexOf(`\n${selector} {`)
  if (start < 0) throw new Error(`ops.css has no ${selector} block`)
  return css.slice(start, css.indexOf('\n}', start))
}

const declarations = (block: string): Map<string, string> =>
  new Map([...block.matchAll(/^\s+(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]))

const lightDecls = declarations(blockAfter(':root'))
const darkDecls = declarations(blockAfter("html[data-theme='dark']"))

type Theme = 'light' | 'dark'
const tokens = (theme: Theme): Map<string, string> =>
  new Map([...lightDecls, ...(theme === 'dark' ? darkDecls : [])])

/** Resolves `var(--x)` chains to a final value. */
const resolve = (map: Map<string, string>, name: string): string => {
  let value = map.get(name)
  if (value === undefined) throw new Error(`${name} is not declared`)
  for (let i = 0; i < 5; i++) {
    const ref = /^var\((--[\w-]+)\)$/.exec(value)
    if (!ref) return value
    value = map.get(ref[1])
    if (value === undefined) throw new Error(`${name} resolves through an undeclared token`)
  }
  throw new Error(`${name} has a var() chain that is too deep`)
}

type Rgb = [number, number, number]
const hex = (value: string): Rgb => {
  const m = /^#([0-9a-f]{6})$/i.exec(value)
  if (!m) throw new Error(`expected a 6-digit hex, got ${value}`)
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as Rgb
}
const luminance = ([r, g, b]: Rgb): number => {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}
const ratio = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb =>
  fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb

/** `--ops-tint-green` etc.: a -deco over transparent at a percent token. */
const tint = (theme: Theme, name: string, surface: Rgb): Rgb => {
  const map = tokens(theme)
  const m = /^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s+var\((--[\w-]+)\),\s*transparent\)$/.exec(
    map.get(name) ?? '',
  )
  if (!m) throw new Error(`${name} is not a color-mix() tint`)
  const percent = Number.parseFloat(resolve(map, m[2]))
  return over(hex(resolve(map, m[1])), surface, percent / 100)
}

const color = (theme: Theme, name: string): Rgb => hex(resolve(tokens(theme), name))

const TEXT = ['ink', 'ink-secondary', 'ink-muted', 'ink-faint'].map((n) => `--ds-${n}`).concat(
  ['primary', 'success', 'info', 'warning', 'danger'].map((n) => `--ds-${n}-text`),
)
const DECO = ['primary', 'success', 'info', 'warning', 'danger'].map((n) => `--ds-${n}-deco`)
/** Text token -> the tints it is set on. */
const ON_TINT: Array<[string, string]> = [
  ['--ds-primary-text', '--ops-tint-primary'],
  ['--ds-primary-text', '--ops-wash-primary'],
  ['--ds-success-text', '--ops-tint-green'],
  ['--ds-info-text', '--ops-tint-sky'],
  ['--ds-warning-text', '--ops-tint-orange'],
  ['--ds-warning-text', '--ops-wash-orange'],
  ['--ds-danger-text', '--ops-tint-red'],
  ['--ds-ink-faint', '--ops-tint-green'],
  ['--ds-ink-faint', '--ops-tint-sky'],
  ['--ds-ink-faint', '--ops-tint-orange'],
  ['--ds-ink-faint', '--ops-tint-red'],
  ['--ds-ink-muted', '--ops-tint-primary'],
]

describe.each(['light', 'dark'] as const)('ops colour tokens (%s)', (theme) => {
  const surfaces = ['--ds-surface', '--ds-surface-soft']

  it.each(TEXT)('%s is AA text on both surfaces', (name) => {
    for (const surface of surfaces) {
      expect(ratio(color(theme, name), color(theme, surface)), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(ON_TINT)('%s is AA text on %s', (text, tintName) => {
    for (const surface of surfaces) {
      const bg = tint(theme, tintName, color(theme, surface))
      expect(ratio(color(theme, text), bg), `${text} on ${tintName} over ${surface}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('white-on-primary text passes at rest and on hover (hover darkens)', () => {
    const onPrimary = color(theme, '--ds-on-primary')
    expect(ratio(onPrimary, color(theme, '--ds-primary'))).toBeGreaterThanOrEqual(4.5)
    const hover = color(theme, '--ds-primary-hover')
    expect(ratio(onPrimary, hover)).toBeGreaterThanOrEqual(4.5)
    expect(luminance(hover)).toBeLessThanOrEqual(luminance(color(theme, '--ds-primary')))
  })

  it.each([...DECO, '--ds-primary', '--ds-focus-ring'])('%s is a 3:1 non-text colour on both surfaces', (name) => {
    for (const surface of surfaces) {
      // Filled buttons and the focus ring are the only non-text colours that
      // must stay distinct on the soft surface in dark mode too.
      expect(ratio(color(theme, name), color(theme, surface)), `${name} on ${surface}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('the focus ring is distinguishable from its gap', () => {
    expect(ratio(color(theme, '--ds-focus-ring'), color(theme, '--ds-focus-gap'))).toBeGreaterThanOrEqual(3)
  })
})

describe('token block hygiene', () => {
  it('declares every dark override in the light block too', () => {
    for (const name of darkDecls.keys()) expect(lightDecls.has(name), name).toBe(true)
  })

  it('no longer binds primary to Payload theme colours', () => {
    expect(blockAfter(':root')).not.toMatch(/--ops-primary[^:]*:\s*var\(--theme-/)
  })
})
