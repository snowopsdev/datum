import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Article slugs become unique. Existing duplicates are resolved first: within
 * each group of rows sharing a slug, the earliest (lowest id) keeps it and
 * every later row gets `-<id>` appended, which no other article can already
 * hold unless someone typed that exact suffix by hand. Empty slugs become NULL,
 * the value the `uniqueArticleSlug` hook writes for "no slug", since the index
 * allows any number of NULLs but only one ''.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "articles" SET "slug" = NULL WHERE "slug" = '';
  UPDATE "articles" AS a SET "slug" = a."slug" || '-' || a."id"
    FROM (
      SELECT "id", row_number() OVER (PARTITION BY "slug" ORDER BY "id") AS rn
      FROM "articles"
      WHERE "slug" IS NOT NULL
    ) AS d
    WHERE a."id" = d."id" AND d.rn > 1;
  DROP INDEX IF EXISTS "articles_slug_idx";
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");`)
}

/** Back to a plain index. The renamed duplicates keep their new slugs. */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "articles_slug_idx";
  CREATE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");`)
}
