/** `undefined` and `null` both mean "no value" on a Payload document. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined)
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  // Union of the keys, so a key present on one side and absent on the other is
  // compared (and, when the present one holds null/undefined, still equal).
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!sameValue(left[key], right[key])) return false
  }
  return true
}
