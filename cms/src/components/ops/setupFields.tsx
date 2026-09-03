'use client'

import React from 'react'

/**
 * The form primitives the setup editors share.
 *
 * `brandVoiceSections.tsx` grew its own copies of these first and keeps them:
 * that file is working, tested, and out of scope here. These are the same
 * shapes generalised for the tenant assets, whose rows carry selects, dates,
 * and nested lists rather than only strings — which is why `RowsEditor` takes
 * a render function instead of a field table.
 */

export function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  multiline,
  placeholder,
  hint,
  type = 'text',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  multiline?: boolean
  placeholder?: string
  hint?: string
  type?: 'text' | 'date' | 'url'
}) {
  return (
    <div className="datum-ops__field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}
      {hint ? <p className="datum-ops__hint">{hint}</p> : null}
    </div>
  )
}

/**
 * A list of rows with add and remove, where the caller draws the row.
 *
 * Row order is meaningful in several of these assets — the descriptor ladder
 * *is* its order — so rows are never sorted here, and removal keeps the rest
 * where they were.
 */
export function RowsEditor<T>({
  id,
  rows,
  onChange,
  empty,
  addLabel,
  disabled,
  max,
  emptyText = 'Nothing added yet.',
  renderRow,
}: {
  id: string
  rows: T[]
  onChange: (rows: T[]) => void
  empty: () => T
  addLabel: string
  disabled: boolean
  max?: number
  emptyText?: string
  renderRow: (args: {
    row: T
    index: number
    rowId: string
    patch: (patch: Partial<T>) => void
  }) => React.ReactNode
}) {
  const patchAt = (index: number, patch: Partial<T>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index))
  const atMax = typeof max === 'number' && rows.length >= max

  return (
    <div className="datum-ops__rows">
      {rows.length === 0 ? <p className="datum-ops__empty">{emptyText}</p> : null}
      {rows.map((row, index) => (
        <div className="datum-ops__row-card" key={`${id}-${index}`}>
          <div className="datum-ops__row-head">
            <span>#{index + 1}</span>
            <button
              type="button"
              className="datum-ops__link-btn"
              onClick={() => remove(index)}
              disabled={disabled}
            >
              Remove
            </button>
          </div>
          {renderRow({
            row,
            index,
            rowId: `${id}-${index}`,
            patch: (patch) => patchAt(index, patch),
          })}
        </div>
      ))}
      <button
        type="button"
        className="datum-ops__btn"
        onClick={() => onChange([...rows, empty()])}
        disabled={disabled || atMax}
      >
        {atMax ? `Maximum ${max}` : addLabel}
      </button>
    </div>
  )
}

/** The `['a', 'b']` lists several assets keep: one text input per entry. */
export function TextRows({
  id,
  label,
  rows,
  onChange,
  disabled,
  placeholder,
  addLabel,
  hint,
}: {
  id: string
  label: string
  rows: string[]
  onChange: (rows: string[]) => void
  disabled: boolean
  placeholder?: string
  addLabel: string
  hint?: string
}) {
  return (
    <div className="datum-ops__field">
      <label htmlFor={`${id}-0`}>{label}</label>
      {hint ? <p className="datum-ops__hint">{hint}</p> : null}
      <div className="datum-ops__textrows">
        {rows.map((row, index) => (
          <div className="datum-ops__textrow" key={`${id}-${index}`}>
            <input
              id={`${id}-${index}`}
              type="text"
              value={row}
              onChange={(e) => onChange(rows.map((r, i) => (i === index ? e.target.value : r)))}
              disabled={disabled}
              placeholder={placeholder}
            />
            <button
              type="button"
              className="datum-ops__link-btn"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              disabled={disabled}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="datum-ops__btn"
        onClick={() => onChange([...rows, ''])}
        disabled={disabled}
      >
        {addLabel}
      </button>
    </div>
  )
}
