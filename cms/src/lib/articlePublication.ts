import type { CollectionBeforeChangeHook } from 'payload'

/**
 * What every transition into `published` leaves on the article, whoever made it.
 *
 * `publishedAt` used to be stamped by the two callers that publish (the ops
 * action and the `publish-due` job), so a publish from the raw document view or
 * the API left it null: no dateline, no `datePublished`, and the piece sorted
 * to the top of the home page. It is stamped here when the write does not carry
 * a new value of its own.
 *
 * `publishAt` is the schedule that has now been used up. Left in place it is
 * inert only until the piece is `approved` again, at which point the
 * five-minute `publish-due` tick finds a date long past and republishes it
 * without anyone asking. Every action that moves an article off `approved`
 * already clears it for that reason; publishing is the one that did not.
 */
export const stampPublication: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (data.status !== 'published' || originalDoc?.status === 'published') return data
  // Payload refills fields the request omitted from the stored document, so an
  // unchanged value here is the previous publication's date, not a new one. A
  // republish therefore always gets a fresh date unless the write supplies a
  // different one, which is what the publish action has always done.
  if (data.publishedAt == null || data.publishedAt === originalDoc?.publishedAt) {
    data.publishedAt = new Date().toISOString()
  }
  data.publishAt = null
  return data
}
