import type { BrandVoiceContent } from './brandVoice'

/**
 * Demo brand voice used by `npm run seed -- --with-brand-voice`, the CMS-side
 * mock extraction, and tests. Banned words are chosen so they do NOT occur in
 * the pipeline's mock generate fixture (`pipeline/src/fixtures.ts`), so a mock
 * `pipeline:run` still reaches `qa_passed`.
 */
export const BRAND_VOICE_FIXTURE: BrandVoiceContent = {
  name: 'Datum demo brand voice',
  essence: {
    oneLiner: 'Datum helps small teams publish search content that ranks without hiring an agency.',
    mission: 'Make every how-to, comparison, and list on the web more useful than the one above it.',
  },
  coreValues: [
    { value: 'Usefulness', description: 'If a sentence does not help the reader do something, cut it.' },
    { value: 'Honesty', description: 'Say what we know, what we guessed, and what we did not test.' },
    { value: 'Speed', description: 'Answer first, context second. Respect the reader’s time.' },
  ],
  audience: {
    description:
      'Founders and marketers at companies with fewer than 50 people who own content but are not full-time writers.',
    languageLevel: 'general',
    interests: 'Practical tooling, pricing transparency, shortcuts that do not cut corners.',
    needs: 'They need to know what to do next without reading 3,000 words to find it.',
  },
  persona:
    'The friend at the party who has already tried the thing you are about to buy. Talks plainly, answers the actual question, cracks a dry joke, and never makes you feel behind.',
  voiceAdjectives: [
    {
      adjective: 'Plain-spoken',
      description: 'Short sentences, concrete nouns, no filler.',
      doExample: 'Spend 40 percent of your budget on the grinder.',
      dontExample: 'It is generally advisable to allocate a meaningful portion of resources toward grinding equipment.',
    },
    {
      adjective: 'Confident',
      description: 'We commit to a recommendation and say why.',
      doExample: 'Pick the Baratza. It is the only one here that adjusts in fine enough steps.',
      dontExample: 'There are many good options and it really depends on your needs.',
    },
    {
      adjective: 'Warm',
      description: 'Encouraging without being cheerful for its own sake.',
      doExample: 'Your first shots will be bad. That is normal, and it passes in a week.',
      dontExample: 'Don’t worry, you’ve totally got this!!',
    },
  ],
  voiceInOwnWords:
    'We sound like an experienced colleague explaining something over coffee: direct, generous with specifics, and quick to admit the limits of what we know.',
  notTraits: [
    { trait: 'Sarcastic', boundaryNote: 'Dry humour is fine; jokes at the reader’s expense are not.' },
    { trait: 'Hype-driven', boundaryNote: 'No “game-changing” claims; let the numbers do the selling.' },
    { trait: 'Academic', boundaryNote: 'No jargon walls or citations for their own sake.' },
  ],
  tone: { formality: 4, warmth: 2, boldness: 2, energy: 3 },
  preferredWords: [
    { word: 'pick', note: 'instead of “select” or “opt for”' },
    { word: 'show', note: 'instead of “demonstrate”' },
    { word: 'because', note: 'always give the reason' },
  ],
  bannedWords: [
    { word: 'synergy', note: 'meaningless corporate filler' },
    { word: 'world-class', note: 'unverifiable superlative' },
    { word: 'disrupt', note: 'hype' },
    { word: 'best-in-class', note: 'unverifiable superlative' },
  ],
  samples: [
    {
      title: 'Product pick intro',
      text: 'We tested six budget grinders for a month. One of them is worth your money, two are fine, and three should not exist. Here is how to tell them apart in under five minutes.',
    },
  ],
}
