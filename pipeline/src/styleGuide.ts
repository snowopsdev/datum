import fs from 'node:fs'
import path from 'node:path'

import { repoRoot } from './config'

export interface StyleGuide {
  text: string
  bannedPhrases: string[]
}

export function parseBannedPhrases(markdown: string): string[] {
  const lines = markdown.split('\n')
  const start = lines.findIndex((l) => /^##\s+Banned phrases\s*$/i.test(l.trim()))
  if (start === -1) return []
  const phrases: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    const match = /^-\s+(.*)$/.exec(line.trim())
    if (match) {
      // "leverage (as a verb)" -> the matchable phrase is "leverage"
      const phrase = match[1].replace(/\s*\([^)]*\)\s*$/, '').trim()
      if (phrase) phrases.push(phrase)
    }
  }
  return phrases
}

export function loadStyleGuide(): StyleGuide {
  const text = fs.readFileSync(path.join(repoRoot, 'docs', 'style-guide.md'), 'utf8')
  return { text, bannedPhrases: parseBannedPhrases(text) }
}
