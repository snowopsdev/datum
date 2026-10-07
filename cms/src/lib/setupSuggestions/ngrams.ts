const STOPWORDS = new Set(
  'a an and are as at be been but by can could do does for from had has have how i if in into is it its may me my no not of on one or our out should so than that the their them then there these they this those to too us was we were what when where which who will with would you your'.split(
    ' ',
  ),
)

export const wordsOf = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

export const meaningfulTokens = (text: string): string[] =>
  wordsOf(text).filter((t) => !STOPWORDS.has(t))

/** Above this many diff cells (generated × published words) the set fallback is used. */
const MAX_DIFF_CELLS = 16_000_000

const MAX_PHRASE_WORDS = 3

interface Token {
  word: string
  sentence: number
}

const sentencesOf = (text: string): string[] => text.split(/[.!?\n]+/)

function tokenize(text: string): { tokens: Token[]; sentences: string[] } {
  const sentences = sentencesOf(text)
  return {
    sentences,
    tokens: sentences.flatMap((sentence, index) =>
      wordsOf(sentence).map((word) => ({ word, sentence: index })),
    ),
  }
}

/**
 * Which generated words the published text no longer has, in place.
 *
 * A longest-common-subsequence alignment of the two word sequences: a word is
 * removed when the alignment skips it. Presence elsewhere does not count as
 * kept — "rich crema" deleted from one sentence is removed even when "rich"
 * and "crema" both survive in others — and a word that stayed beside a
 * deleted one is not dragged into the deletion. Returns null when the texts
 * are too long to align, and the caller falls back to comparing phrase sets.
 */
function removedMask(generated: string[], published: string[]): boolean[] | null {
  const n = generated.length
  const m = published.length
  if ((n + 1) * (m + 1) > MAX_DIFF_CELLS) return null
  const width = m + 1
  const table = new Uint16Array((n + 1) * width)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      table[i * width + j] =
        generated[i - 1] === published[j - 1]
          ? table[(i - 1) * width + j - 1] + 1
          : Math.max(table[(i - 1) * width + j], table[i * width + j - 1])
    }
  }
  const removed = new Array<boolean>(n).fill(true)
  for (let i = n, j = m; i > 0 && j > 0; ) {
    if (generated[i - 1] === published[j - 1]) {
      removed[i - 1] = false
      i--
      j--
    } else if (table[(i - 1) * width + j] >= table[i * width + j - 1]) {
      i--
    } else {
      j--
    }
  }
  return removed
}

/** Mark every occurrence of a banned phrase, so it splits a removed run instead of joining one. */
function bannedMask(tokens: Token[], banned: string[][]): boolean[] {
  const mask = new Array<boolean>(tokens.length).fill(false)
  for (const phrase of banned) {
    if (phrase.length === 0) continue
    for (let i = 0; i + phrase.length <= tokens.length; i++) {
      if (phrase.every((word, k) => tokens[i + k].word === word)) {
        for (let k = 0; k < phrase.length; k++) mask[i + k] = true
      }
    }
  }
  return mask
}

/** Every one- to three-word phrase in `words` that a reviewer could ban, keyed to `excerpt`. */
function addPhrases(
  into: Map<string, string>,
  words: string[],
  excerpt: string,
  excludedWords: Set<string>,
): void {
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= MAX_PHRASE_WORDS && i + n <= words.length; n++) {
      const run = words.slice(i, i + n)
      if (run.some((t) => STOPWORDS.has(t) || excludedWords.has(t) || /\d/.test(t))) continue
      into.set(run.join(' '), excerpt)
    }
  }
}

/** All phrases in a text, sentence-bounded; the published side of the "kept" test. */
export function phraseNgrams(text: string, excludedWords: readonly string[] = []): Map<string, string> {
  const excluded = new Set(excludedWords.flatMap(wordsOf))
  const result = new Map<string, string>()
  for (const sentence of sentencesOf(text)) {
    addPhrases(result, wordsOf(sentence), sentence.trim().slice(0, 300), excluded)
  }
  return result
}

/**
 * The phrases a reviewer deleted between the generated and the published text,
 * each with the generated sentence it came from.
 *
 * Phrases come only from runs of removed words within one sentence. Keyword
 * words never count; a banned phrase splits a run rather than poisoning every
 * phrase that shares one of its words, so banning "in today's fast-paced
 * world" does not hide a removed phrase that merely contains "world".
 */
export function removedPhraseNgrams(
  generatedText: string,
  publishedText: string,
  options: { keyword?: string; banned?: readonly string[] } = {},
): Map<string, string> {
  const excluded = new Set(wordsOf(options.keyword ?? ''))
  const generated = tokenize(generatedText)
  const published = wordsOf(publishedText)
  const removed = removedMask(
    generated.tokens.map((t) => t.word),
    published,
  )
  if (removed === null) {
    // Too long to align: fall back to phrases the published text lacks entirely.
    const kept = new Set(phraseNgrams(publishedText).keys())
    const all = phraseNgrams(generatedText, [options.keyword ?? ''])
    return new Map([...all].filter(([phrase]) => !kept.has(phrase) && !isBanned(phrase, options.banned)))
  }
  const banned = bannedMask(
    generated.tokens,
    (options.banned ?? []).map(wordsOf),
  )
  const result = new Map<string, string>()
  let run: string[] = []
  let sentence = -1
  const flush = () => {
    if (run.length > 0) {
      addPhrases(result, run, generated.sentences[sentence].trim().slice(0, 300), excluded)
    }
    run = []
  }
  generated.tokens.forEach((token, index) => {
    if (token.sentence !== sentence) {
      flush()
      sentence = token.sentence
    }
    if (removed[index] && !banned[index]) run.push(token.word)
    else flush()
  })
  flush()
  return result
}

/** True when `phrase` contains a banned phrase as a contiguous run of words. */
export function isBanned(phrase: string, banned: readonly string[] = []): boolean {
  const words = wordsOf(phrase)
  return banned.some((entry) => {
    const run = wordsOf(entry)
    return (
      run.length > 0 &&
      words.some((_, i) => run.every((word, k) => words[i + k] === word))
    )
  })
}
