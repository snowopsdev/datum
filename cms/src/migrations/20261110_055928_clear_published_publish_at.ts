import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Clear the used-up schedule on articles that are already published.
 *
 * The `stampPublication` hook clears `publishAt` on every transition into
 * `published`, but rows published before it existed kept their old date. Moved
 * back to `approved`, such a row has a `publishAt` long in the past, and the
 * next `publish-due` tick republishes it without anyone asking.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "articles" SET "publish_at" = NULL WHERE "status" = 'published' AND "publish_at" IS NOT NULL;`)
}

/**
 * A no-op: the cleared dates were schedules that had already been used, and
 * nothing records which rows held one, so there is nothing to put back.
 */
export async function down(_args: MigrateDownArgs): Promise<void> {}
