/** Rounds to a fixed number of decimal places. */
export const roundTo = (n: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(n * factor) / factor
}

/** Narrows `unknown` to a plain object, rejecting null and arrays. */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Drops falsy entries and narrows the type, so conditional list items can be written inline with `&&`. */
export const compact = <T>(items: (T | false | null | undefined)[]): T[] => items.filter((x): x is T => Boolean(x))
