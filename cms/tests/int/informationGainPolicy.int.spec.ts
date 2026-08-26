import { describe, expect, it } from 'vitest'

import { InformationGainPolicy } from '@/globals/InformationGainPolicy'
import { POLICY_FIELDS } from '@/lib/informationGain'

import type { Field } from 'payload'

/** Only some field types carry `admin.description` in Payload's union. */
const descriptionOf = (field: Field): string =>
  field.type === 'number' || field.type === 'select' ? String(field.admin?.description ?? '') : ''

describe('Information-gain policy global', () => {
  it('mirrors POLICY_FIELDS field for field, in order, with no persisted default', () => {
    const names = InformationGainPolicy.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(POLICY_FIELDS.map((f) => f.key))

    for (const [index, def] of POLICY_FIELDS.entries()) {
      const field = InformationGainPolicy.fields[index]
      expect(field.type).toBe(def.kind === 'boolean' ? 'select' : 'number')
      // No Payload `defaultValue`: it would be persisted on the first admin
      // save, which `resolvePolicy` could not tell from a real admin choice.
      expect('defaultValue' in field).toBe(false)
      expect('required' in field).toBe(false)
      expect(descriptionOf(field)).toContain(def.env)
      expect(descriptionOf(field)).toContain(def.outcome)
      expect(descriptionOf(field)).toContain(String(def.default))
    }
  })

  it('renders boolean gates as a clearable Enabled/Disabled select, not a checkbox', () => {
    // An unchecked checkbox is indistinguishable from an unset one, which would
    // show the three BLOCK gates (all defaulting to true) as if they were off.
    for (const [index, def] of POLICY_FIELDS.entries()) {
      if (def.kind !== 'boolean') continue
      const field = InformationGainPolicy.fields[index]
      expect(field.type).toBe('select')
      if (field.type !== 'select') continue
      expect(field.options).toEqual([
        { label: 'Enabled', value: 'true' },
        { label: 'Disabled', value: 'false' },
      ])
      expect(field.admin?.isClearable).toBe(true)
    }
  })

  it('bounds ratio fields to 0–1 and counts to non-negative', () => {
    for (const [index, def] of POLICY_FIELDS.entries()) {
      const field = InformationGainPolicy.fields[index]
      if (def.kind === 'ratio') {
        expect(field.type).toBe('number')
        if (field.type === 'number') {
          expect(field.min).toBe(0)
          expect(field.max).toBe(1)
        }
      }
      if (def.kind === 'count' && field.type === 'number') {
        expect(field.min).toBe(0)
        expect(field.max).toBeUndefined()
      }
    }
  })

  it('humanises the field label', () => {
    const coverage = InformationGainPolicy.fields.find(
      (f) => 'name' in f && f.name === 'minConsensusCoverage',
    )
    expect(coverage && 'label' in coverage ? coverage.label : undefined).toBe(
      'Min consensus coverage',
    )
  })

  it('is readable and editable only when authenticated', async () => {
    expect(await InformationGainPolicy.access?.read?.({ req: { user: null } } as never)).toBe(false)
    expect(await InformationGainPolicy.access?.read?.({ req: { user: { id: 1 } } } as never)).toBe(
      true,
    )
    expect(await InformationGainPolicy.access?.update?.({ req: { user: null } } as never)).toBe(
      false,
    )
    expect(
      await InformationGainPolicy.access?.update?.({ req: { user: { id: 1 } } } as never),
    ).toBe(true)
  })

  it('audits every change', () => {
    expect(typeof InformationGainPolicy.hooks?.afterChange?.[0]).toBe('function')
  })
})
