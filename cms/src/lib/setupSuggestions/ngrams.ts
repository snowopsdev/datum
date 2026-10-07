const STOPWORDS = new Set(
  'a an and are as at be been but by can could do does for from had has have how i if in into is it its may me my no not of on one or our out should so than that the their them then there these they this those to too us was we were what when where which who will with would you your'.split(
    ' ',
  ),
)
export const wordsOf = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
export const meaningfulTokens = (text: string): string[] =>
  wordsOf(text).filter((t) => !STOPWORDS.has(t))
export function phraseNgrams(text: string, excluded: readonly string[] = []): Map<string, string> {
  const banned = new Set(excluded.flatMap(wordsOf))
  const result = new Map<string, string>()
  for (const sentence of text.split(/[.!?\n]+/)) {
    const words = wordsOf(sentence)
    for (let i = 0; i < words.length; i++)
      for (let n = 1; n <= 3 && i + n <= words.length; n++) {
        const row = words.slice(i, i + n)
        if (row.some((t) => STOPWORDS.has(t) || banned.has(t) || /\d/.test(t))) continue
        result.set(row.join(' '), sentence.trim().slice(0, 300))
      }
  }
  return result
}
