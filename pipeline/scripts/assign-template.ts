// Stand-in for the human admin step: tag a topic_selected article with a template.
// Usage: tsx scripts/assign-template.ts <articleId> <templateName>
import { initPayload } from '../src/payloadClient'

const [articleIdArg, ...templateNameParts] = process.argv.slice(2)
const articleId = Number.parseInt(articleIdArg ?? '', 10)
const templateName = templateNameParts.join(' ')
if (Number.isNaN(articleId) || !templateName) {
  console.error('Usage: tsx scripts/assign-template.ts <articleId> <templateName>')
  process.exit(1)
}

const payload = await initPayload()
const { docs } = await payload.find({
  collection: 'templates',
  where: { name: { equals: templateName } },
  limit: 1,
})
if (docs.length === 0) {
  console.error(`No template named "${templateName}"`)
  process.exit(1)
}
await payload.update({ collection: 'articles', id: articleId, data: { template: docs[0].id } })
console.log(`article ${articleId} -> template "${templateName}" (${docs[0].id})`)
process.exit(0)
