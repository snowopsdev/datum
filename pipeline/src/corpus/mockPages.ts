/**
 * Canned competitor page bodies for `MOCK_MODE=true`, so a corpus snapshot can
 * be built end to end with no network and no API keys.
 *
 * The prose deliberately matches the mock `generate` fixture in `fixtures.ts`
 * (setting up a home espresso station), because mock generation returns that
 * article whatever the keyword is — a corpus about anything else would make
 * every coverage and exactness signal meaningless in mock runs.
 *
 * All four bodies share the same five facets — budget, equipment, recipe,
 * mistakes, cleaning — with one sentence per facet repeated verbatim across
 * every host. The information-gain fixtures quote those sentences as excerpts,
 * so editing their wording here breaks excerpt verification in the fixtures.
 */

import { hostnameOf } from '../informationGain/lib'

const BUDGET = 'Most beginners spend between $500 and $1,500 on a first espresso setup.'
const EQUIPMENT = 'The grinder matters more than the machine.'
const RECIPE = 'Start with 18 grams in and 36 grams out in 25 to 30 seconds.'
const MISTAKES =
  'Stale beans are the most common cause of bad espresso; use beans within a month of roasting.'
const CLEANING = 'Purge the steam wand before and after each use and backflush weekly.'

interface MockPage {
  title: string
  text: string
}

const paragraph = (...sentences: string[]): string => sentences.join(' ')

const competitorOne: MockPage = {
  title: 'The complete guide to setting up a home espresso station',
  text: paragraph(
    'A home espresso station is three things in a row: a grinder, a machine, and a small',
    'patch of counter you keep clean.',
    BUDGET,
    'That range covers a dual-boiler-adjacent single boiler, a stepless burr grinder, a scale',
    'that reads tenths of a gram, a tamper that matches your basket, and a knock box.',
    'Buy the grinder first if you have to split the purchase across two months.',
    EQUIPMENT,
    'A mediocre machine with an excellent grinder makes a drinkable shot; the reverse makes an',
    'expensive puddle, because grind distribution decides how water moves through the puck.',
    'Give the station about two feet of bench and a nearby outlet on its own circuit.',
    'Once the gear lands, rinse the boiler twice and pull two blank shots to flush the group.',
    'Then weigh everything, every time, until the numbers stop surprising you.',
    RECIPE,
    'Time the shot from the moment you press the button, not from first drip, and taste it',
    'before you change anything.',
    'If it runs fast and tastes sour, grind finer by one or two marks and pull again.',
    'If it chokes and tastes bitter, go coarser and check that your dose still fits the basket.',
    'Change one variable at a time, write down what you did, and expect a week of practice',
    'before the routine feels automatic.',
    'The failures are predictable and almost all of them are supply problems rather than',
    'technique problems.',
    MISTAKES,
    'Check the roast date on the bag rather than the best-by date, buy in half-kilo lots, and',
    'store the bag folded shut at room temperature instead of in the freezer.',
    'Skipping the scale is the second-most common mistake, because a dose guessed by eye',
    'swings by two grams and turns every shot into a fresh experiment.',
    'Tamping unevenly is third; press straight down and stop worrying about how hard.',
    'Maintenance is what keeps a good setup good after the first enthusiastic month.',
    CLEANING,
    'Wipe the wand with a damp cloth immediately so milk never dries on the tip, run a',
    'detergent backflush once a month, and pull the shower screen to scrub it at the same time.',
    'Brush the grinder chute weekly and take the burrs out for a clean every few months, or',
    'whenever the grind starts drifting for no reason you can explain.',
    'Descale on the schedule your water hardness demands, which for most tap water means twice',
    'a year, and use filtered water if your kettle scales up quickly.',
    'A station that gets ten minutes of care a week will still be pulling good shots in five',
    'years, which is the whole point of buying decent gear once.',
  ),
}

const competitorTwo: MockPage = {
  title: 'Home espresso setup: what actually works in 2026',
  text: paragraph(
    'We rebuilt our test kitchen station four times this year, so here is the short version of',
    'what survived and what we sold on.',
    'Skip the all-in-one bean-to-cup machines; they hide every variable you need to see.',
    BUDGET,
    'Below that you are fighting temperature swings, and above it you are paying for a bigger',
    'boiler than a two-cup morning will ever need.',
    'Our current bench runs a mid-range heat-exchanger machine with a flat-burr grinder, and',
    'the grinder cost more than half the total.',
    EQUIPMENT,
    'Every blind tasting we ran came back the same way: upgrading the grinder changed the cup,',
    'upgrading the machine changed the convenience.',
    'Convenience is worth something once you are making four drinks a morning, but it is not',
    'where a first budget belongs.',
    'Add a bottomless portafilter early, because it shows you channelling that a spouted basket',
    'politely hides.',
    'A recipe is the fastest way to stop chasing your own tail.',
    RECIPE,
    'That ratio works for the overwhelming majority of modern light-to-medium roasts, and it',
    'gives you a fixed point to move away from once you know what you like.',
    'For darker roasts, pull the yield back toward 30 grams and expect a shorter time.',
    'For anything roasted very light, extend to 40 grams out and accept a 35 second shot.',
    'Log the dose, the yield, the time, and one word about taste; three days of that beats a',
    'month of guessing.',
    'The mistakes we see in reader emails are boringly consistent.',
    MISTAKES,
    'Supermarket bags with no roast date are the single biggest cause of complaints that begin',
    'with "my new machine is broken".',
    'The second is water: hard tap water scales a boiler quickly and dulls the cup, so filter it.',
    'The third is dosing into a basket that does not fit the dose, which produces channelling no',
    'amount of tamping technique will fix.',
    'Cleaning is the part everyone agrees with and nobody schedules.',
    CLEANING,
    'Set a recurring reminder for the backflush, because the difference between a machine',
    'backflushed weekly and one backflushed when you remember is a group head full of rancid oil.',
    'Rinse the basket and portafilter under hot water after each session rather than leaving',
    'them sitting in coffee grounds overnight.',
    'Once a month, take the shower screen off, soak the removable metal in cleaner, and wipe the',
    'drip tray properly.',
    'None of this is difficult, and all of it is the difference between a station you use daily',
    'and one that quietly becomes a very expensive kettle stand.',
  ),
}

const industryMag: MockPage = {
  title: '10 lessons from building a home espresso station the hard way',
  text: paragraph(
    'Our editors have collectively spent more on espresso gear than any of us would like to',
    'defend in print, so consider this a list of expensive lessons offered free.',
    'Lesson one is about money, and it is the one most readers argue with.',
    BUDGET,
    'Two of us went cheaper and replaced the whole setup inside a year, which cost more than',
    'buying properly the first time.',
    'Lesson two settles the argument that fills our inbox every January.',
    EQUIPMENT,
    'We ran the same beans through a $200 grinder and a $700 grinder on the same machine, and',
    'the difference was audible in the room when people tasted them.',
    'Lesson three: buy a scale before you buy anything decorative.',
    'Lesson four: leave the machine on for twenty minutes before the first shot, because a cold',
    'group head undoes everything else you got right.',
    'Lesson five is the recipe, and it is the shortest lesson here.',
    RECIPE,
    'Write it on a sticky note and put it on the machine until you no longer need it.',
    'Lesson six: change one thing per shot, or you learn nothing from either change.',
    'Lesson seven: milk is a separate skill, and it deserves its own week of practice with cheap',
    'milk you do not mind pouring down the sink.',
    'Lesson eight is the one that produces the most reader mail.',
    MISTAKES,
    'A roast date is not a marketing detail; it is the only number on the bag that predicts',
    'whether tomorrow morning will taste like anything.',
    'Lesson nine: your water matters as much as your beans, and a cheap filter jug fixes most of',
    'what is wrong with it.',
    'Lesson ten is the least glamorous and the most load-bearing of the ten.',
    CLEANING,
    'A group head that has never been backflushed will make a clean shot taste like the last',
    'twenty shots stacked on top of each other.',
    'We keep a cloth for the wand, a brush for the grinder, and a blind basket in the drawer,',
    'and the whole routine costs about ten minutes a week.',
    'Do those ten things and a modest station will out-perform a showroom machine that nobody',
    'has cleaned since the day it arrived.',
    'That, more than any single purchase, is the lesson we would send back to ourselves five',
    'years ago along with a much shorter shopping list.',
  ),
}

const genericPage: MockPage = {
  title: 'Home espresso station basics',
  text: paragraph(
    'Building a home espresso station takes an afternoon of setup and about a week of practice',
    'before the results are worth serving to somebody else.',
    'Start by deciding what you are willing to spend, because that decision drives every other',
    'one on the list.',
    BUDGET,
    'Split that budget with the grinder in mind rather than the machine, which is the single',
    'most repeated piece of advice in the category.',
    EQUIPMENT,
    'Grind consistency controls how evenly water passes through the coffee, and no machine can',
    'correct for a grinder that produces boulders and dust in the same dose.',
    'You also need a scale that reads tenths of a gram, a tamper sized to your basket, a cloth',
    'for the steam wand, and somewhere to knock out the used puck.',
    'Set the whole thing up near a sink if you can, because every step involves water.',
    'With the gear in place, work to a fixed recipe rather than by feel.',
    RECIPE,
    'Grind finer when the shot runs too fast and coarser when it stalls, and adjust one setting',
    'at a time so you can tell what actually changed.',
    'Taste every shot before you decide what to fix, since the numbers only describe the shot',
    'and your palate decides whether it was good.',
    'Most early disappointment comes from the beans rather than the technique.',
    MISTAKES,
    'Buy small bags often, keep them sealed at room temperature, and treat anything past six',
    'weeks from roast as practice coffee rather than something to serve.',
    'The other common errors are guessing the dose instead of weighing it, and using water hard',
    'enough to scale the boiler within a few months.',
    'Finally, build a cleaning habit while the machine is still new and you still care.',
    CLEANING,
    'Rinse the portafilter and basket after every session, wipe the drip tray down, and take the',
    'shower screen off once a month to scrub it properly.',
    'Clean the grinder burrs every few months, or sooner if the grind setting starts drifting',
    'without explanation.',
    'A station kept this way stays pleasant to use, and the daily routine settles into about',
    'five minutes from first grind to a clean bench.',
  ),
}

const PAGES_BY_HOST: Record<string, MockPage> = {
  'competitor-one.com': competitorOne,
  'competitor-two.com': competitorTwo,
  'industry-mag.example.com': industryMag,
}

/** The canned body for a mock URL; hosts we have no page for get the generic one. */
export function mockPageText(url: string): MockPage {
  const host = hostnameOf(url)
  return (host && PAGES_BY_HOST[host]) || genericPage
}
